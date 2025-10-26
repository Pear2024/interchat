"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabaseClient, getServiceSupabaseClient } from "@/lib/supabaseServer";

export async function toggleRoomLock(roomId: string, lock: boolean) {
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

  const { data: roomRecord } = await serviceClient
    .from("rooms")
    .select("created_by")
    .eq("id", roomId)
    .maybeSingle();

  const actorRole = actorMembership?.role ?? null;
  const isCreator = roomRecord?.created_by === user.id;

  if (!isCreator && (!actorRole || !["admin", "owner"].includes(actorRole))) {
    return { error: "Only admins or owners can change lock status." };
  }

  const { error } = await serviceClient
    .from("rooms")
    .update({
      is_locked: lock,
      updated_at: new Date().toISOString(),
    })
    .eq("id", roomId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/rooms/${roomId}`);
  revalidatePath("/rooms");

  return { success: true };
}
