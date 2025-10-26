"use server";

import { redirect } from "next/navigation";
import { createHash } from "crypto";
import { getServerSupabaseClient, getServiceSupabaseClient } from "@/lib/supabaseServer";

function buildPairKey(userIdA: string, userIdB: string) {
  return [userIdA, userIdB].sort().join(":");
}

function buildDirectSlug(pairKey: string) {
  const hash = createHash("sha256").update(pairKey).digest("hex").slice(0, 12);
  return `dm-${hash}`;
}

export async function openDirectRoom(targetUserId: string) {
  const supabase = await getServerSupabaseClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    redirect("/login");
  }

  if (user.id === targetUserId) {
    return { error: "ไม่สามารถเริ่มห้องสนทนาแบบตัวต่อตัวกับตัวเองได้" };
  }

  const serviceClient = getServiceSupabaseClient();

  const { data: targetProfile } = await serviceClient
    .from("profiles")
    .select("id, display_name, preferred_language")
    .eq("id", targetUserId)
    .maybeSingle();

  if (!targetProfile) {
    return { error: "ไม่พบผู้ใช้ปลายทาง" };
  }

  const { data: currentProfile } = await serviceClient
    .from("profiles")
    .select("display_name, preferred_language")
    .eq("id", user.id)
    .maybeSingle();

  const pairKey = buildPairKey(user.id, targetUserId);

  const { data: existingRoom } = await serviceClient
    .from("rooms")
    .select("id, slug")
    .eq("room_type", "direct")
    .eq("direct_pair_key", pairKey)
    .maybeSingle();

  if (existingRoom) {
    redirect(`/rooms/${existingRoom.slug}`);
  }

  const creatorName = currentProfile?.display_name ?? "You";
  const targetName = targetProfile.display_name ?? "Member";

  const roomName = `${creatorName} ↔ ${targetName}`;
  const slug = buildDirectSlug(pairKey);

  const { data: insertedRoom, error } = await serviceClient
    .from("rooms")
    .insert({
      slug,
      name: roomName,
      description: null,
      room_type: "direct",
      default_language:
        currentProfile?.preferred_language ??
        targetProfile.preferred_language ??
        "en",
      created_by: user.id,
      direct_pair_key: pairKey,
    })
    .select("id, slug")
    .single();

  if (error || !insertedRoom) {
    return {
      error:
        error?.message ??
        "ไม่สามารถสร้างห้องสนทนาได้ กรุณาลองใหม่อีกครั้ง",
    };
  }

  await serviceClient.from("room_members").upsert([
    {
      room_id: insertedRoom.id,
      user_id: user.id,
      role: "owner",
      notifications: "all",
    },
    {
      room_id: insertedRoom.id,
      user_id: targetUserId,
      role: "member",
      notifications: "all",
    },
  ]);

  redirect(`/rooms/${insertedRoom.slug}`);
}
