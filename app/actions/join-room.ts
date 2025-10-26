"use server";

import { revalidatePath } from "next/cache";
import {
  getServerSupabaseClient,
  getServiceSupabaseClient,
} from "@/lib/supabaseServer";

type JoinRoomResult =
  | { success: "joined"; slug: string }
  | { success: "already-member"; slug: string }
  | { error: string };

async function postMembershipMessage(
  serviceClient: ReturnType<typeof getServiceSupabaseClient>,
  {
    roomId,
    userId,
    content,
  }: { roomId: string; userId: string; content: string }
) {
  try {
    await serviceClient.from("messages").insert({
      room_id: roomId,
      author_id: userId,
      content,
      original_language: "en",
      detected_language: "en",
    });
  } catch (error) {
    console.error("Failed to post membership message", error);
  }
}

export async function joinRoom(roomId: string): Promise<JoinRoomResult> {
  const serverSupabase = await getServerSupabaseClient();
  const { data: userResult } = await serverSupabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    return { error: "Please sign in again." };
  }

  const serviceSupabase = getServiceSupabaseClient();

  const { data: room, error: roomError } = await serviceSupabase
    .from("rooms")
    .select("id, slug, name, is_locked, room_type")
    .eq("id", roomId)
    .maybeSingle<{
      id: string;
      slug: string;
      name: string;
      is_locked: boolean | null;
      room_type: string | null;
    }>();

  if (roomError) {
    return { error: roomError.message };
  }

  if (!room || room.room_type !== "group") {
    return { error: "Room is not available to join." };
  }

  if (room.is_locked) {
    return { error: "This room is locked and cannot be joined." };
  }

  const { data: existingMembership } = await serviceSupabase
    .from("room_members")
    .select("room_id")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingMembership) {
    return { success: "already-member", slug: room.slug };
  }

  const { error: insertError } = await serviceSupabase
    .from("room_members")
    .upsert(
      {
        room_id: roomId,
        user_id: user.id,
        role: "member",
        notifications: "all",
      },
      { onConflict: "room_id,user_id" }
    );

  if (insertError) {
    return { error: insertError.message };
  }

  const { data: profile } = await serviceSupabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle<{ display_name: string | null }>();

  const displayName =
    profile?.display_name?.trim() || user.email || "A member";

  await postMembershipMessage(serviceSupabase, {
    roomId,
    userId: user.id,
    content: `🔔 ${displayName} joined the room.`,
  });

  revalidatePath("/rooms");
  revalidatePath(`/rooms/${room.slug}`);

  return { success: "joined", slug: room.slug };
}
