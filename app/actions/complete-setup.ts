"use server";

import { revalidatePath } from "next/cache";
import {
  getServerSupabaseClient,
  getServiceSupabaseClient,
} from "@/lib/supabaseServer";

type CompleteSetupInput = {
  displayName: string;
  preferredLanguage: string;
  password: string;
  confirmPassword: string;
};

export type CompleteSetupResult = {
  success?: boolean;
  error?: string;
};

export async function completeFirstTimeSetup(
  input: CompleteSetupInput
): Promise<CompleteSetupResult> {
  try {
    const supabase = await getServerSupabaseClient();
    const { data: userResult } = await supabase.auth.getUser();
    const user = userResult.user;

    if (!user) {
      return { error: "Missing session. Please sign in again." };
    }

    if (user.is_anonymous || !user.email) {
      return {
        error:
          "This session is anonymous. Please use the magic link from your email to finish setting up your account.",
      };
    }

    const displayName = input.displayName.trim();
    if (!displayName) {
      return { error: "Display name is required." };
    }

    const preferredLanguage = input.preferredLanguage?.trim() || "en";

    if (!input.password || input.password.length < 8) {
      return { error: "Password must be at least 8 characters." };
    }

    if (input.password !== input.confirmPassword) {
      return { error: "Passwords do not match." };
    }

    const updatedMetadata = {
      ...(user.user_metadata ?? {}),
      display_name: displayName,
      preferred_language: preferredLanguage,
      password_configured: true,
    };

    const { error: updateAuthError } = await supabase.auth.updateUser({
      password: input.password,
      data: updatedMetadata,
    });

    if (updateAuthError) {
      return { error: updateAuthError.message };
    }

    const serviceSupabase = getServiceSupabaseClient();

    await serviceSupabase.from("profiles").upsert(
      {
        id: user.id,
        display_name: displayName,
        preferred_language: preferredLanguage,
      },
      { onConflict: "id" }
    );

    revalidatePath("/rooms");
    revalidatePath("/rooms/pricing");
    revalidatePath("/rooms/manage");

    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to complete setup right now.",
    };
  }
}
