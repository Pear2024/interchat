import { redirect } from "next/navigation";
import { SetupProfileForm } from "@/app/components/setup-profile-form";
import {
  getServerSupabaseClient,
  getServiceSupabaseClient,
} from "@/lib/supabaseServer";

export default async function SetupProfilePage() {
  const supabase = await getServerSupabaseClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    redirect("/login");
  }

  if (user.is_anonymous || !user.email) {
    redirect(
      "/login?error=Please%20open%20the%20magic%20link%20we%20sent%20to%20finish%20setting%20up%20your%20account."
    );
  }

  if (user.user_metadata?.password_configured === true) {
    redirect("/rooms");
  }

  const serviceSupabase = getServiceSupabaseClient();

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

  const defaultLanguageCode =
    languages.find((language) => language.code === "en")?.code ??
    languages[0]?.code ??
    "en";

  const { data: profile } = await serviceSupabase
    .from("profiles")
    .select("display_name, preferred_language")
    .eq("id", user.id)
    .maybeSingle();

  const displayName =
    profile?.display_name ??
    (typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name
      : user.email?.split("@")[0] ?? "Member");

  const preferredLanguage =
    profile?.preferred_language ??
    (typeof user.user_metadata?.preferred_language === "string"
      ? user.user_metadata.preferred_language
      : defaultLanguageCode);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#1b233a,_#090b12_55%)] px-4 py-12 text-slate-50">
      <div className="w-full max-w-3xl">
        <SetupProfileForm
          email={user.email ?? "ไม่พบอีเมล"}
          initialDisplayName={displayName}
          initialLanguage={preferredLanguage}
          languages={languages}
        />
      </div>
    </div>
  );
}
