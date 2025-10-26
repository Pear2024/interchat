"use server";

import { getServerSupabaseClient, getServiceSupabaseClient } from "@/lib/supabaseServer";

export async function updatePreferredLanguage(language: string) {
  if (!language) {
    return { error: "Language code is required." };
  }

  try {
    const supabase = await getServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return { error: "No active session." };
    }

    const serviceClient = getServiceSupabaseClient();
    const now = new Date().toISOString();

    const { error } = await serviceClient
      .from("profiles")
      .upsert(
        {
          id: session.user.id,
          preferred_language: language,
          updated_at: now,
        },
        { onConflict: "id" }
      );

    if (error) {
      return { error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
