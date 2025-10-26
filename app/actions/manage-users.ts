"use server";

import { revalidatePath } from "next/cache";
import {
  getServiceSupabaseClient,
  getServerSupabaseClient,
} from "@/lib/supabaseServer";
import { DEMO_ROOM_ID } from "@/lib/chatTypes";

type ActionResult = {
  success?: boolean;
  error?: string;
};

async function ensureAdmin() {
  const serverSupabase = await getServerSupabaseClient();
  const { data: userResult } = await serverSupabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    throw new Error("Missing session");
  }

  const serviceSupabase = getServiceSupabaseClient();

  const { data: membership, error } = await serviceSupabase
    .from("room_members")
    .select("role")
    .eq("room_id", DEMO_ROOM_ID)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || membership?.role !== "admin") {
    throw new Error("Not authorized");
  }

  return { userId: user.id, serviceSupabase };
}

export type CreateMemberInput = {
  email: string;
  password: string;
  displayName: string;
  preferredLanguage: string;
  role: "admin" | "owner" | "moderator" | "member";
};

export async function createMember(input: CreateMemberInput): Promise<ActionResult> {
  try {
    const { serviceSupabase } = await ensureAdmin();

    const email = input.email.trim().toLowerCase();
    if (!email) {
      return { error: "Email is required." };
    }

    if (!input.password || input.password.trim().length < 8) {
      return { error: "Password must be at least 8 characters." };
    }

    const preferredLanguage =
      input.preferredLanguage?.trim() || "en";

    const createResult = await serviceSupabase.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        display_name: input.displayName,
        preferred_language: preferredLanguage,
        password_configured: true,
      },
    });

    if (createResult.error) {
      return { error: createResult.error.message };
    }

    const createdUser = createResult.data?.user;
    if (!createdUser) {
      return { error: "Failed to create user." };
    }

    await serviceSupabase.from("profiles").upsert({
      id: createdUser.id,
      display_name: input.displayName,
      preferred_language: preferredLanguage,
    });

    await serviceSupabase.from("room_members").upsert(
      {
        room_id: DEMO_ROOM_ID,
        user_id: createdUser.id,
        role: input.role,
        notifications: "all",
      },
      { onConflict: "room_id,user_id" }
    );

    revalidatePath("/rooms");
    revalidatePath("/rooms/pricing");
    revalidatePath("/rooms/manage");

    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Unable to create member right now.",
    };
  }
}

export type UpdateMemberInput = {
  userId: string;
  displayName: string;
  preferredLanguage: string | null;
  role: "admin" | "owner" | "moderator" | "member";
};

export async function updateMember(input: UpdateMemberInput): Promise<ActionResult> {
  try {
    const { serviceSupabase } = await ensureAdmin();

    const displayName = input.displayName.trim();
    if (!displayName) {
      return { error: "Display name is required." };
    }

    await serviceSupabase
      .from("profiles")
      .update({
        display_name: displayName,
        preferred_language: input.preferredLanguage,
      })
      .eq("id", input.userId);

    await serviceSupabase
      .from("room_members")
      .upsert(
        {
          room_id: DEMO_ROOM_ID,
          user_id: input.userId,
          role: input.role,
          notifications: "all",
        },
        { onConflict: "room_id,user_id" }
      );

    revalidatePath("/rooms");
    revalidatePath("/rooms/pricing");
    revalidatePath("/rooms/manage");

    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Unable to update member right now.",
    };
  }
}

export async function deleteMember(userId: string): Promise<ActionResult> {
  try {
    const { serviceSupabase, userId: currentUserId } = await ensureAdmin();

    if (userId === currentUserId) {
      return { error: "You cannot delete your own account." };
    }

    await serviceSupabase
      .from("room_members")
      .delete()
      .match({ room_id: DEMO_ROOM_ID, user_id: userId });

    const { error: deleteError } = await serviceSupabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      return { error: deleteError.message };
    }

    revalidatePath("/rooms");
    revalidatePath("/rooms/pricing");
    revalidatePath("/rooms/manage");

    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Unable to delete member right now.",
    };
  }
}
