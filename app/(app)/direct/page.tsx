import { redirect } from "next/navigation";
import { getServerSupabaseClient, getServiceSupabaseClient } from "@/lib/supabaseServer";
import DirectList from "@/app/components/direct-list";

export default async function DirectMessagesPage() {
  const supabase = await getServerSupabaseClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    redirect("/login");
  }

  const serviceClient = getServiceSupabaseClient();

  const { data: profiles } = await serviceClient
    .from("profiles")
    .select("id, display_name, preferred_language")
    .neq("id", user.id)
    .order("display_name", { ascending: true });

  const safeProfiles =
    profiles?.map((profile) => ({
      id: profile.id,
      displayName: profile.display_name ?? "Member",
      preferredLanguage: profile.preferred_language ?? "en",
    })) ?? [];

  return (
    <div className="flex min-h-screen justify-center bg-[radial-gradient(circle_at_top,_#1b233a,_#090b12_55%)] px-6 py-10 text-slate-50">
      <div className="w-full max-w-4xl">
        <DirectList
          currentUserId={user.id}
          profiles={safeProfiles}
        />
      </div>
    </div>
  );
}
