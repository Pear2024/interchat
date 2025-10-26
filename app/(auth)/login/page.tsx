import { redirect } from "next/navigation";
import LoginForm from "./login-form";
import { getServerSupabaseClient } from "@/lib/supabaseServer";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const supabase = await getServerSupabaseClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (
    user &&
    !user.is_anonymous &&
    user.user_metadata?.password_configured === true
  ) {
    redirect("/");
  }

  const { data: languageRows } = await supabase
    .from("languages")
    .select("code, english_name, native_name")
    .order("english_name", { ascending: true })
    .limit(200);

  const languages = (languageRows ?? []).map((language) => ({
    code: language.code,
    english_name: language.english_name,
    native_name: language.native_name,
  }));

  const fallbackLanguages = languages.length > 0 ? languages : [
    { code: "en", english_name: "English", native_name: "English" },
    { code: "th", english_name: "Thai", native_name: "ไทย" },
    { code: "he", english_name: "Hebrew", native_name: "עברית" },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#1b233a,_#090b12_55%)] px-4 py-10 text-slate-50">
      <LoginForm
        languages={fallbackLanguages}
        initialError={searchParams?.error}
      />
    </div>
  );
}
