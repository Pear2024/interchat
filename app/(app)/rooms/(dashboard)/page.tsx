import { redirect } from "next/navigation";
import { getServerSupabaseClient } from "@/lib/supabaseServer";
import { DEMO_ROOM_SLUG } from "@/lib/chatTypes";

type MembershipRow = {
  room:
    | { slug: string | null }
    | Array<{ slug: string | null }>
    | null;
};

export default async function RoomsIndexPage() {
  const supabase = await getServerSupabaseClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    redirect("/login");
  }

  const userId = user.id;

  const { data: memberships } = await supabase
    .from("room_members")
    .select("room:rooms!inner(slug)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true })
    .limit(1);

  const membershipRows = (memberships ?? []) as MembershipRow[];
  const firstSlugRow = membershipRows[0] ?? null;
  const firstSlug =
    (firstSlugRow && !Array.isArray(firstSlugRow.room)
      ? firstSlugRow.room?.slug
      : Array.isArray(firstSlugRow?.room)
      ? firstSlugRow?.room[0]?.slug
      : null) ?? DEMO_ROOM_SLUG;

  redirect(`/rooms/${firstSlug}`);
}
