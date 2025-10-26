import Link from "next/link";
import type { ReactNode } from "react";

const sections: Array<{ title: string; body: ReactNode[] }> = [
  {
    title: "ข้อมูลที่เรารวบรวม",
    body: [
      "เมื่อคุณใช้ Interchat เราอาจจัดเก็บข้อมูลบัญชีขั้นพื้นฐาน เช่น อีเมล ชื่อที่คุณระบุ และภาษาที่คุณเลือก เพื่อปรับปรุงประสบการณ์ใช้งาน.",
      "ข้อความที่ถูกส่งในระบบจะถูกเก็บไว้เพื่อให้สมาชิกในห้องเห็นและเพื่อให้บริการแปลภาษาแบบเรียลไทม์. สำหรับผู้ใช้แบบไม่ระบุตัวตน เราจะเก็บข้อมูลให้น้อยที่สุดเท่าที่จำเป็น.",
    ],
  },
  {
    title: "วิธีที่เราใช้ข้อมูล",
    body: [
      "ข้อมูลใช้เพื่อจัดการสิทธิ์การเข้าถึงห้องสนทนา ปรับภาษาให้ตรงกับความต้องการ และดูแลความปลอดภัยของระบบ.",
      "ข้อความอาจถูกส่งไปยังผู้ให้บริการภายนอกเพื่อประมวลผลการแปล (เช่น OpenAI) โดยเราจะส่งเฉพาะข้อความที่จำเป็นต่อการให้บริการ.",
    ],
  },
  {
    title: "การแบ่งปันข้อมูล",
    body: [
      "เราไม่ขายข้อมูลส่วนบุคคลให้บุคคลที่สาม.",
      "เราอาจแบ่งปันข้อมูลกับผู้ให้บริการที่จำเป็นต่อการดำเนินงาน เช่น Supabase สำหรับการจัดเก็บข้อมูลและการยืนยันตัวตน.",
    ],
  },
  {
    title: "การเก็บรักษาและความปลอดภัย",
    body: [
      "ข้อมูลถูกจัดเก็บบนโครงสร้างพื้นฐานของ Supabase และผู้ให้บริการคลาวด์ที่มีมาตรฐานความปลอดภัยสูง.",
      "คุณสามารถขอให้เราลบข้อมูลของคุณได้โดยติดต่อเราตามช่องทางด้านล่าง.",
    ],
  },
  {
    title: "สิทธิของคุณ",
    body: [
      "คุณสามารถขอดู ปรับปรุง หรือขอลบข้อมูลส่วนบุคคลที่เรามีได้.",
      "หากไม่ต้องการรับการสื่อสารทางอีเมลเพิ่มเติม คุณสามารถยกเลิกได้ตลอดเวลา.",
    ],
  },
  {
    title: "การติดต่อ",
    body: [
      "หากมีคำถามเกี่ยวกับนโยบายความเป็นส่วนตัวนี้ กรุณาติดต่อ: ",
      <Link
        key="privacy-contact-email"
        href="mailto:support@my-interchat.com"
        className="underline underline-offset-4"
      >
        support@my-interchat.com
      </Link>,
    ],
  },
];

export default function PrivacyPolicyPage() {
  const lastUpdated = new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-6 py-16 text-slate-100">
      <header className="space-y-3 text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
          นโยบายความเป็นส่วนตัว
        </p>
        <h1 className="text-3xl font-semibold text-white">
          Privacy Policy – Interchat
        </h1>
        <p className="text-sm text-slate-300">
          อัปเดตล่าสุด {lastUpdated}
        </p>
      </header>

      <section className="space-y-10 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-black/30 backdrop-blur-xl">
        {sections.map((section) => (
          <article key={section.title} className="space-y-3">
            <h2 className="text-xl font-semibold text-white">{section.title}</h2>
            <div className="space-y-2 text-sm leading-relaxed text-slate-200">
              {section.body.map((paragraph, index) => (
                <p key={`${section.title}-${index}`}>{paragraph}</p>
              ))}
            </div>
          </article>
        ))}
      </section>

      <footer className="text-center text-xs text-slate-500">
        หากคุณใช้บริการของเรา แสดงว่าคุณยินยอมตามนโยบายความเป็นส่วนตัวฉบับนี้.
      </footer>
    </main>
  );
}
