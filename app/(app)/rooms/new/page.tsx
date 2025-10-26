import { redirect } from "next/navigation";
import { getServerSupabaseClient } from "@/lib/supabaseServer";
import { ensureProfile } from "@/app/actions/ensure-profile";
import CreateRoomForm from "@/app/components/create-room-form";

export default async function NewRoomPage() {
  const supabase = await getServerSupabaseClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    redirect("/login");
  }

  if (user.is_anonymous) {
    redirect("/rooms");
  }

  await ensureProfile();

  const { data: languages } = await supabase
    .from("languages")
    .select("code, english_name")
    .order("english_name", { ascending: true })
    .limit(200);

  const mappedLanguages =
    languages?.map((lang) => ({
      code: lang.code,
      english_name: lang.english_name,
    })) ?? [];

  const defaultLanguage =
    mappedLanguages.find((lang) => lang.code === user.user_metadata?.preferred_language)?.code ??
    mappedLanguages[0]?.code ??
    "en";

  return (
    <div className="flex min-h-screen justify-center bg-[radial-gradient(circle_at_top,_#1b233a,_#090b12_55%)] px-6 py-10 text-slate-50">
      <div className="w-full max-w-4xl">
        <CreateRoomForm
          languages={mappedLanguages}
          defaultLanguage={defaultLanguage}
        />
      </div>
    </div>
  );
}
