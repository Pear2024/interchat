import type { ReactNode } from "react";
import Link from "next/link";

const sections: Array<{ title: string; body: ReactNode[] }> = [
  {
    title: "การยอมรับเงื่อนไข",
    body: [
      "การใช้ Interchat ถือว่าคุณยอมรับข้อกำหนดการให้บริการฉบับนี้ หากคุณไม่ยอมรับ กรุณาหยุดใช้งานทันที.",
      "เราขอสงวนสิทธิ์ในการปรับปรุงเงื่อนไข โดยจะแจ้งให้ทราบผ่านหน้าเอกสารนี้เมื่อมีการเปลี่ยนแปลง.",
    ],
  },
  {
    title: "การใช้งานบัญชี",
    body: [
      "คุณต้องรับผิดชอบต่อกิจกรรมทั้งหมดที่เกิดขึ้นภายใต้บัญชีของคุณ และต้องเก็บข้อมูลการเข้าสู่ระบบเป็นความลับ.",
      "ห้ามใช้ระบบเพื่อทำกิจกรรมที่ผิดกฎหมาย คุกคาม หรือสร้างความเสียหายให้แก่ผู้อื่น.",
    ],
  },
  {
    title: "เนื้อหาและการกลั่นกรอง",
    body: [
      "ข้อความที่คุณส่งจะถูกแบ่งปันภายในห้องที่คุณเข้าร่วม และอาจถูกใช้เพื่อให้บริการแปลภาษา.",
      "เราสามารถลบหรือจำกัดเนื้อหาที่ละเมิดกฎหมาย ละเมิดสิทธิ หรือขัดต่อแนวทางชุมชนได้ตามสมควร.",
    ],
  },
  {
    title: "บริการแปลภาษา",
    body: [
      "การแปลแบบเรียลไทม์อาศัยบริการจากผู้ให้บริการภายนอก (เช่น OpenAI) และอาจมีความคลาดเคลื่อนบ้าง.",
      "คุณควรตรวจสอบข้อความที่แปลก่อนนำไปใช้ในบริบทสำคัญ เราไม่รับผิดชอบความเสียหายที่เกิดจากการแปลผิดพลาด.",
    ],
  },
  {
    title: "การระงับหรือยุติการให้บริการ",
    body: [
      "เราสามารถระงับหรือยุติการเข้าถึงของคุณได้ หากพบว่ามีการละเมิดข้อกำหนดหรือสร้างความเสี่ยงต่อระบบ.",
      "คุณสามารถขอยุติการใช้งานได้ทุกเมื่อโดยหยุดใช้บริการและลบบัญชีหากจำเป็น.",
    ],
  },
  {
    title: "ข้อจำกัดความรับผิด",
    body: [
      "บริการนี้ให้ใช้งานตามสภาพ (as-is) เราไม่รับประกันว่าจะปราศจากข้อผิดพลาดหรือพร้อมใช้งานตลอดเวลา.",
      "ความรับผิดรวมสูงสุดของเรา ไม่ว่าจะในกรณีใด จะไม่เกินจำนวนเงินที่คุณจ่ายให้เราในช่วง 6 เดือนล่าสุด หรือหากใช้งานฟรีจะเป็นศูนย์.",
    ],
  },
  {
    title: "การติดต่อเรา",
    body: [
      "หากมีคำถามเกี่ยวกับข้อกำหนดการให้บริการ กรุณาติดต่อ: ",
      <Link
        key="tos-contact-email"
        href="mailto:support@my-interchat.com"
        className="underline underline-offset-4"
      >
        support@my-interchat.com
      </Link>,
    ],
  },
];

export default function TermsOfServicePage() {
  const lastUpdated = new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-6 py-16 text-slate-100">
      <header className="space-y-3 text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
          ข้อกำหนดการให้บริการ
        </p>
        <h1 className="text-3xl font-semibold text-white">
          Terms of Service – Interchat
        </h1>
        <p className="text-sm text-slate-300">อัปเดตล่าสุด {lastUpdated}</p>
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
        การใช้บริการต่อไปถือว่าคุณยอมรับข้อกำหนดทั้งหมดในเอกสารนี้.
      </footer>
    </main>
  );
}
