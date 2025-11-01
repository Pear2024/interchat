import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import VoiceTranslator from "@/app/components/voice-translator";
import { ensureProfile } from "@/app/actions/ensure-profile";
import { getServerSupabaseClient } from "@/lib/supabaseServer";
import { languageLabel } from "@/lib/chatTypes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VoiceTranslatorPage() {
  const supabase = await getServerSupabaseClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    redirect("/login");
  }

  await ensureProfile();

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_language")
    .eq("id", user.id)
    .maybeSingle();

  const cookieStore = await cookies();
  const fallbackLanguage =
    profile?.preferred_language ||
    cookieStore.get("preferred_language")?.value ||
    "en";

  const targetLanguage = fallbackLanguage.toLowerCase();

  return (
    <div className="flex min-h-screen justify-center bg-[radial-gradient(circle_at_top,_#1b233a,_#090b12_55%)] px-6 py-12 text-slate-50">
      <div className="w-full space-y-8 rounded-[32px] border border-white/10 bg-white/5 px-8 py-10 shadow-[0_40px_80px_-30px_rgba(15,23,42,0.9)] backdrop-blur-xl">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Experimental labs</p>
              <h1 className="text-3xl font-semibold text-white">Voice translator (PoC)</h1>
              <p className="text-sm text-slate-300">
                พูดผ่านไมโครโฟนแล้วดูผลการถอดเสียงพร้อมแปลเป็นภาษา{" "}
                <span className="font-semibold text-white">{languageLabel(targetLanguage)}</span>{" "}
                ที่คุณตั้งไว้ใน Settings ระบบนี้ทำงานภายในเบราว์เซอร์ของคุณและรองรับบน Chrome หรือ Edge เท่านั้น
              </p>
            </div>
            <Link
              href="/rooms"
              className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-white/40 hover:bg-white/20"
            >
              ← Back to rooms
            </Link>
          </div>
        </header>

        <VoiceTranslator targetLanguage={targetLanguage} />

        <section className="rounded-3xl border border-white/10 bg-slate-950/50 px-6 py-6 shadow-inner shadow-black/30">
          <h2 className="text-base font-semibold text-white">ข้อจำกัดของเวอร์ชันทดลอง</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
            <li>รองรับเฉพาะเบราว์เซอร์ที่มี Web Speech API (Chrome, Edge)</li>
            <li>เสียงจะถูกประมวลผลบนเครื่องคุณ ข้อมูลจะถูกส่งไปเฉพาะข้อความที่ถอดเสียงแล้ว</li>
            <li>ควรใช้เครือข่ายที่เสถียร และเปิดแท็บนี้ทิ้งไว้ระหว่างใช้งาน</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
