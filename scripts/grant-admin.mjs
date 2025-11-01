import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_ROOM_ID = "11111111-1111-1111-1111-111111111111";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: node scripts/grant-admin.mjs <email>");
    process.exit(1);
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("Supabase environment variables are missing.");
    process.exit(1);
  }

  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await client.auth.admin.getUserByEmail(email);
  if (error || !data?.user) {
    console.error("Unable to find user:", error?.message ?? "not found");
    process.exit(1);
  }

  const userId = data.user.id;

  const { error: upsertError } = await client
    .from("room_members")
    .upsert(
      {
        room_id: DEMO_ROOM_ID,
        user_id: userId,
        role: "admin",
        notifications: "all",
      },
      { onConflict: "room_id,user_id" }
    );

  if (upsertError) {
    console.error("Failed to assign admin role:", upsertError.message);
    process.exit(1);
  }

  console.log(`Admin privileges granted for ${email}.`);
}

main();
