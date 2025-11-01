import Link from "next/link";

export default function HomeChinese() {
  const languages = [
    { href: "/", label: "ไทย", active: false },
    { href: "/en", label: "English", active: false },
    { href: "/ja", label: "日本語", active: false },
    { href: "/es", label: "Español", active: false },
    { href: "/zh", label: "中文", active: true },
    { href: "/ru", label: "Русский", active: false },
  ];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#171c2e,_#070910_60%)] text-slate-100">
      <section className="mx-auto flex min-h-[70vh] w-full max-w-6xl flex-col items-center justify-center px-6 py-20 text-center">
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400">
          {languages.map((lang) => (
            <Link
              key={lang.href}
              href={lang.href}
              className={`rounded-full border px-3 py-1 transition ${
                lang.active
                  ? "border-indigo-400 bg-indigo-500/20 text-white"
                  : "border-white/15 text-slate-300 hover:border-white/30 hover:text-white"
              }`}
            >
              {lang.label}
            </Link>
          ))}
        </div>
        <p className="mt-8 text-xs uppercase tracking-[0.4em] text-indigo-300/80">
          InterChat Workspace
        </p>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          打造跨語言協作的全球溝通中心
        </h1>
        <p className="mt-6 max-w-2xl text-base text-slate-300 sm:text-lg">
          InterChat 透過即時翻譯與直覺的對話介面，讓跨國團隊協作不再受語言限制。不論成員使用哪種語言，都能在瞬間建立共識。
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/rooms"
            className="rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/40 transition hover:scale-[1.02]"
          >
            開啟 InterChat
          </Link>
          <Link
            href="/rooms"
            className="rounded-full border border-white/20 px-8 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5"
          >
            登入 / 建立帳號
          </Link>
        </div>
        <p className="mt-6 text-xs uppercase tracking-[0.35em] text-slate-500">
          讓每位成員都能自信使用母語表達
        </p>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "即時對話",
              description:
                "同時支援多語言協作，透過神經翻譯快速呈現訊息，維持對話流暢度。",
            },
            {
              title: "靈活的房間管理",
              description:
                "依照專案或客戶建立房間，自由設定權限與開放狀態，確保資訊安全。",
            },
            {
              title: "翻譯歷程保存",
              description:
                "隨時回溯對話與翻譯紀錄，避免交接時遺漏重要資訊。",
            },
          ].map((feature) => (
            <article
              key={feature.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 text-left shadow-lg shadow-black/30 backdrop-blur-xl"
            >
              <h2 className="text-lg font-semibold text-white">{feature.title}</h2>
              <p className="mt-3 text-sm text-slate-300">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="rounded-[32px] border border-white/10 bg-gradient-to-br from-slate-900/70 via-slate-900/40 to-indigo-900/40 p-8 shadow-[0_30px_80px_-40px_rgba(21,33,66,0.9)] backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.35em] text-indigo-200/80">
            開始使用就是這麼簡單
          </p>
          <h2 className="mt-4 text-2xl font-semibold text-white">
            3 步驟打造無國界協作
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              {
                title: "註冊或登入",
                description: "使用 Supabase 帳號即可快速登入或註冊新的 InterChat 帳號。",
              },
              {
                title: "建立協作房間",
                description: "命名房間、邀請成員並設定預設語言，立刻展開團隊討論。",
              },
              {
                title: "立即展開協作",
                description: "自然輸入或發言，InterChat 會即時翻譯給所有人，確保溝通無礙。",
              },
            ].map((step, index) => (
              <div
                key={step.title}
                className="rounded-3xl border border-white/10 bg-white/5 p-6 text-left"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/30 text-base font-semibold text-indigo-200">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{step.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/rooms"
              className="rounded-full bg-white px-8 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-slate-100"
            >
              立即開始使用 InterChat
            </Link>
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">
              適用於各種產業場景
            </span>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-slate-950/60 py-10 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} InterChat. 專為全球團隊打造。
      </footer>
    </main>
  );
}
