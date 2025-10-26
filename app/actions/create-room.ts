"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSupabaseClient, getServiceSupabaseClient } from "@/lib/supabaseServer";

const MAX_CUSTOM_ROOMS = 3;

type CreateRoomInput = {
  name: string;
  description?: string | null;
  defaultLanguage?: string | null;
};

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createRoom(input: CreateRoomInput) {
  const serverSupabase = await getServerSupabaseClient();
  const { data: userResult } = await serverSupabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    redirect("/login");
  }

  if (user.is_anonymous) {
    return { error: "Guest accounts cannot create new rooms. Please sign in." };
  }

  const rawName = normalizeName(input.name ?? "");

  if (!rawName || rawName.length < 3) {
    return { error: "Please enter a room name (at least 3 characters)." };
  }

  const serviceClient = getServiceSupabaseClient();

  const { count: existingOwnedRooms } = await serviceClient
    .from("rooms")
    .select("id", { head: true, count: "exact" })
    .eq("created_by", user.id);

  if ((existingOwnedRooms ?? 0) >= MAX_CUSTOM_ROOMS) {
    return {
      error: `You can create up to ${MAX_CUSTOM_ROOMS} rooms on your plan. Please upgrade or archive a room.`,
    };
  }

  const baseSlug = slugify(rawName) || `room-${Date.now()}`;
  let roomSlug = baseSlug;
  let suffix = 1;

  // Ensure slug uniqueness
  while (true) {
    const { data: existingRoom, error: slugError } = await serviceClient
      .from("rooms")
      .select("id")
      .eq("slug", roomSlug)
      .maybeSingle();

    if (slugError) {
      return { error: slugError.message };
    }

    if (!existingRoom) {
      break;
    }

    roomSlug = `${baseSlug}-${suffix++}`;
  }

  const defaultLanguage =
    input.defaultLanguage?.trim().toLowerCase() ?? "en";

  const { data: insertedRoom, error: insertError } = await serviceClient
    .from("rooms")
    .insert({
      slug: roomSlug,
      name: rawName,
      description: input.description ?? null,
      default_language: defaultLanguage,
      created_by: user.id,
      room_type: "group",
    })
    .select("id, slug")
    .single();

  if (insertError || !insertedRoom) {
    return {
      error:
        insertError?.message ?? "Unable to create room. Please try again later.",
    };
  }

  await serviceClient.from("room_members").insert({
    room_id: insertedRoom.id,
    user_id: user.id,
    role: "owner",
    notifications: "all",
  });

  revalidatePath("/rooms");
  revalidatePath("/rooms/manage");

  redirect(`/rooms/${roomSlug}`);
}
