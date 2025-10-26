"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabaseClient, getServiceSupabaseClient } from "@/lib/supabaseServer";

type RemoveRoomMemberInput = {
  roomId: string;
  memberId: string;
};

export async function removeRoomMember({ roomId, memberId }: RemoveRoomMemberInput) {
  const supabase = await getServerSupabaseClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    return { error: "Please sign in again." };
  }

  const serviceClient = getServiceSupabaseClient();

  const { data: actorMembership } = await serviceClient
    .from("room_members")
    .select("role")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();

  const actorRole = actorMembership?.role ?? null;

  const { data: roomRecord } = await serviceClient
    .from("rooms")
    .select("created_by")
    .eq("id", roomId)
    .maybeSingle();

  const isCreator = roomRecord?.created_by === user.id;

  if (!isCreator && (!actorRole || !["owner", "admin"].includes(actorRole))) {
    return { error: "Only admins or owners can remove members." };
  }

  if (memberId === user.id) {
    return { error: "You cannot remove yourself." };
  }

  const { data: targetMembership } = await serviceClient
    .from("room_members")
    .select("role")
    .match({ room_id: roomId, user_id: memberId })
    .maybeSingle();

  if (!targetMembership) {
    return { error: "Member not found." };
  }

  if (
    !isCreator &&
    actorRole === "owner" &&
    ["admin", "owner"].includes(targetMembership.role ?? "")
  ) {
    return { error: "Only admins can remove other owners or admins." };
  }

  const { error: deleteError } = await serviceClient
    .from("room_members")
    .delete()
    .match({ room_id: roomId, user_id: memberId });

  if (deleteError) {
    return { error: deleteError.message };
  }

  revalidatePath(`/rooms/${roomId}`);
  revalidatePath("/rooms/manage");

  return { success: true };
}
