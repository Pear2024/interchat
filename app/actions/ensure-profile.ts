"use server";

import { cookies } from "next/headers";
import { getServerSupabaseClient, getServiceSupabaseClient } from "@/lib/supabaseServer";
import { ensureCreditBalance } from "@/lib/credits";
import { DEMO_ROOM_ID } from "@/lib/chatTypes";

function generateGuestName() {
  return `Guest-${Math.floor(1000 + Math.random() * 9000)}`;
}

const WELCOME_CREDITS = 100;

export async function ensureProfile() {
  const supabase = await getServerSupabaseClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    return { error: "User session not found." };
  }

  const serviceClient = getServiceSupabaseClient();
  const cookieStore = await cookies();
  const requestedLanguage =
    cookieStore.get("preferred_language")?.value?.trim().toLowerCase() ?? null;
  const now = new Date().toISOString();
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const isDesignatedAdmin = Boolean(
    user.email && adminEmails.includes(user.email.toLowerCase())
  );

  const { data: existingProfile, error: profileError } = await serviceClient
    .from("profiles")
    .select("id, display_name, preferred_language, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return { error: profileError.message };
  }

  if (existingProfile?.display_name) {
    if (
      requestedLanguage &&
      requestedLanguage !== (existingProfile.preferred_language ?? undefined)
    ) {
      await serviceClient
        .from("profiles")
        .update({
          preferred_language: requestedLanguage,
          updated_at: now,
        })
        .eq("id", user.id);
    }

    const initialCredits =
      user.app_metadata?.provider === "anonymous" ? 0 : WELCOME_CREDITS;
      await ensureCreditBalance(user.id, initialCredits, serviceClient);
    if (isDesignatedAdmin) {
      await serviceClient
        .from("room_members")
        .upsert(
          {
            room_id: DEMO_ROOM_ID,
            user_id: user.id,
            role: "admin",
            notifications: "all",
          },
          { onConflict: "room_id,user_id" }
        );
    }
    return { success: true, displayName: existingProfile.display_name };
  }

  const displayName = user.app_metadata?.provider === "anonymous"
    ? generateGuestName()
    : user.email?.split("@")[0] ?? "Member";

  const { error: upsertError } = await serviceClient
    .from("profiles")
    .upsert(
      {
        id: user.id,
        display_name: displayName,
        preferred_language: requestedLanguage ?? existingProfile?.preferred_language ?? "en",
        created_at: existingProfile?.created_at ?? now,
        updated_at: now,
      },
      { onConflict: "id" }
    );

  if (upsertError) {
    return { error: upsertError.message };
  }

  const initialCredits =
    user.app_metadata?.provider === "anonymous" ? 0 : WELCOME_CREDITS;
  await ensureCreditBalance(user.id, initialCredits, serviceClient);

  if (isDesignatedAdmin) {
    await serviceClient
      .from("room_members")
      .upsert(
        {
          room_id: DEMO_ROOM_ID,
          user_id: user.id,
          role: "admin",
          notifications: "all",
        },
        { onConflict: "room_id,user_id" }
      );
  }

  return { success: true, displayName };
}
