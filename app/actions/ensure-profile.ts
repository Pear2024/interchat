"use server";

import { getServerSupabaseClient, getServiceSupabaseClient } from "@/lib/supabaseServer";
import { ensureCreditBalance } from "@/lib/credits";

function generateGuestName() {
  return `Guest-${Math.floor(1000 + Math.random() * 9000)}`;
}

const WELCOME_CREDITS = 30;

export async function ensureProfile() {
  const supabase = await getServerSupabaseClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    return { error: "User session not found." };
  }

  const serviceClient = getServiceSupabaseClient();

  const { data: existingProfile, error: profileError } = await serviceClient
    .from("profiles")
    .select("id, display_name, preferred_language, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return { error: profileError.message };
  }

  if (existingProfile?.display_name) {
    const initialCredits =
      user.app_metadata?.provider === "anonymous" ? 0 : WELCOME_CREDITS;
    await ensureCreditBalance(user.id, initialCredits, serviceClient);
    return { success: true, displayName: existingProfile.display_name };
  }

  const displayName = user.app_metadata?.provider === "anonymous"
    ? generateGuestName()
    : user.email?.split("@")[0] ?? "Member";

  const now = new Date().toISOString();

  const { error: upsertError } = await serviceClient
    .from("profiles")
    .upsert(
      {
        id: user.id,
        display_name: displayName,
        preferred_language: existingProfile?.preferred_language ?? "en",
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

  return { success: true, displayName };
}
