import { redirect } from "next/navigation";
import LanguageSettingsForm, { LanguageOption } from "./language-settings-form";
import { getServerSupabaseClient } from "@/lib/supabaseServer";
import { cookies } from "next/headers";

export default async function SettingsPage() {
  const supabase = await getServerSupabaseClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    redirect("/login");
  }

  const { data: languagesData } = await supabase
    .from("languages")
    .select("code, english_name, native_name")
    .order("english_name", { ascending: true })
    .limit(200);

  const languages: LanguageOption[] = (languagesData ?? []).map((language) => ({
    code: language.code,
    english_name: language.english_name,
    native_name: language.native_name,
  }));

  if (languages.length === 0) {
    languages.push(
      { code: "en", english_name: "English", native_name: "English" },
      { code: "th", english_name: "Thai", native_name: "ไทย" }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_language")
    .eq("id", user.id)
    .maybeSingle();

  const cookieStore = await cookies();
  const fallbackLanguage =
    profile?.preferred_language ||
    cookieStore.get("preferred_language")?.value ||
    languages[0]?.code ||
    "en";

  return (
    <div className="flex min-h-screen justify-center bg-[radial-gradient(circle_at_top,_#1b233a,_#090b12_55%)] px-6 py-12 text-slate-50">
      <div className="w-full max-w-4xl rounded-[32px] border border-white/10 bg-white/5 p-10 shadow-[0_40px_80px_-30px_rgba(15,23,42,0.9)] backdrop-blur-xl">
        <LanguageSettingsForm
          languages={languages}
          initialLanguage={fallbackLanguage}
        />
      </div>
    </div>
  );
}
