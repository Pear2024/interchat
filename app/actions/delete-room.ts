"use server";

import { revalidatePath } from "next/cache";
import {
  getServerSupabaseClient,
  getServiceSupabaseClient,
} from "@/lib/supabaseServer";

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

type DeleteRoomResult =
  | { success: "room-deleted" | "left-room"; error?: undefined }
  | { success?: undefined; error: string };

export async function deleteOrLeaveRoom(roomId: string): Promise<DeleteRoomResult> {
  const serverSupabase = await getServerSupabaseClient();
  const { data: userResult } = await serverSupabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    return { error: "Please sign in again." };
  }

  const serviceSupabase = getServiceSupabaseClient();

  const { data: membership, error: membershipError } = await serviceSupabase
    .from("room_members")
    .select("role")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle<{ role: string | null }>();

  if (membershipError) {
    return { error: membershipError.message };
  }

  if (!membership) {
    return { error: "You are not a member of this room." };
  }

  const role = membership.role ?? "member";

  const { data: roomRecord } = await serviceSupabase
    .from("rooms")
    .select("slug, room_type")
    .eq("id", roomId)
    .maybeSingle<{ slug: string; room_type: string | null }>();

  if (role === "owner" || role === "admin") {
    const { error: deleteError } = await serviceSupabase
      .from("rooms")
      .delete()
      .eq("id", roomId);

    if (deleteError) {
      return { error: deleteError.message };
    }

    revalidatePath("/rooms");
    revalidatePath("/rooms/manage");
    return { success: "room-deleted" };
  }

  let displayName: string | null = null;
  const { data: profile } = await serviceSupabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle<{ display_name: string | null }>();
  displayName = profile?.display_name ?? user.email ?? "A member";

  if (roomRecord?.room_type === "group") {
    await postMembershipMessage(serviceSupabase, {
      roomId,
      userId: user.id,
      content: `👋 ${displayName} left the room.`,
    });
  }

  const { error: leaveError } = await serviceSupabase
    .from("room_members")
    .delete()
    .match({ room_id: roomId, user_id: user.id });

  if (leaveError) {
    return { error: leaveError.message };
  }

  revalidatePath("/rooms");
  if (roomRecord?.slug) {
    revalidatePath(`/rooms/${roomRecord.slug}`);
  }
  return { success: "left-room" };
}
