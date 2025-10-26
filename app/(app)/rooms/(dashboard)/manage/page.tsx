import { redirect } from "next/navigation";
import {
  getServerSupabaseClient,
  getServiceSupabaseClient,
} from "@/lib/supabaseServer";
import { ManageUsersPanel } from "@/app/components/manage-users-panel";
import { DEMO_ROOM_ID } from "@/lib/chatTypes";

type RoomMemberRow = {
  user_id: string;
  role: "admin" | "owner" | "moderator" | "member" | null;
  joined_at: string | null;
  profiles: {
    display_name: string | null;
    preferred_language: string | null;
  } | null;
};

export default async function ManageMembersPage() {
  const supabase = await getServerSupabaseClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    redirect("/login");
  }

  const serviceSupabase = getServiceSupabaseClient();

  const { data: ownerMembership } = await serviceSupabase
    .from("room_members")
    .select("role")
    .eq("room_id", DEMO_ROOM_ID)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!ownerMembership || !["admin", "owner"].includes(ownerMembership.role ?? "")) {
    redirect("/rooms");
  }

  const viewerRole = (ownerMembership.role ?? "member") as
    | "admin"
    | "owner"
    | "moderator"
    | "member";

  const { data: languagesData } = await serviceSupabase
    .from("languages")
    .select("code, english_name, native_name")
    .order("english_name", { ascending: true })
    .limit(200);

  const languages =
    languagesData?.map((language) => ({
      code: language.code,
      english_name: language.english_name,
      native_name: language.native_name,
    })) ?? [];

  if (languages.length === 0) {
    languages.push(
      { code: "en", english_name: "English", native_name: "English" },
      { code: "th", english_name: "Thai", native_name: "ไทย" }
    );
  }

  const { data: memberRows } = await serviceSupabase
    .from("room_members")
    .select(
      `
        user_id,
        role,
        joined_at,
        profiles:profiles(display_name, preferred_language)
      `
    )
    .eq("room_id", DEMO_ROOM_ID)
    .order("joined_at", { ascending: true })
    .returns<RoomMemberRow[]>();

  const usersResponse = await serviceSupabase.auth.admin.listUsers({
    perPage: 1000,
  });

  const emailById = new Map<string, string | null>();
  usersResponse.data?.users.forEach((listedUser) => {
    emailById.set(listedUser.id, listedUser.email ?? null);
  });

  const members =
    memberRows?.map((row) => ({
      id: row.user_id,
      email: emailById.get(row.user_id) ?? null,
      displayName: row.profiles?.display_name ?? emailById.get(row.user_id) ?? "Member",
      preferredLanguage: row.profiles?.preferred_language ?? null,
      role: (row.role ?? "member") as "admin" | "owner" | "moderator" | "member",
      joinedAt: row.joined_at,
    })) ?? [];

  return (
    <div className="flex min-h-screen justify-center bg-[radial-gradient(circle_at_top,_#1b233a,_#090b12_55%)] px-6 py-10 text-slate-50">
      <div className="w-full max-w-6xl space-y-6">
        <header className="rounded-[32px] border border-white/10 bg-white/5 px-8 py-8 shadow-[0_40px_80px_-30px_rgba(15,23,42,0.9)] backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
            Workspace Admin
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            จัดการสมาชิกและสิทธิ์
          </h1>
          <p className="mt-3 text-sm text-slate-400">
            เพิ่มแก้ไข หรือลบสมาชิกในห้อง พร้อมกำหนดสิทธิ์ admin / owner / moderator / member
          </p>
        </header>

        <ManageUsersPanel
          members={members}
          languages={languages}
          currentUserId={user.id}
          roomId={DEMO_ROOM_ID}
          allowRoomRemoval
          viewerRole={viewerRole}
        />
      </div>
    </div>
  );
}
