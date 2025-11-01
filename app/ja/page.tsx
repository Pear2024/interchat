import Link from "next/link";

export default function HomeJapanese() {
  const languages = [
    { href: "/", label: "ไทย", active: false },
    { href: "/en", label: "English", active: false },
    { href: "/ja", label: "日本語", active: true },
    { href: "/es", label: "Español", active: false },
    { href: "/zh", label: "中文", active: false },
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
          言語の壁を越えたグローバル・コラボレーション
        </h1>
        <p className="mt-6 max-w-2xl text-base text-slate-300 sm:text-lg">
          InterChat は超高速のリアルタイム翻訳と使いやすいチャット体験で世界中のチームをつなぎます。相手がどの言語を使っていても、自然なコミュニケーションが可能です。
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/rooms"
            className="rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/40 transition hover:scale-[1.02]"
          >
            InterChat を開く
          </Link>
          <Link
            href="/rooms"
            className="rounded-full border border-white/20 px-8 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5"
          >
            ログイン / 新規登録
          </Link>
        </div>
        <p className="mt-6 text-xs uppercase tracking-[0.35em] text-slate-500">
          チーム全員が自分の言語で参加できます
        </p>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "リアルタイム会話",
              description:
                "複数言語を同時に翻訳。話者のコンテキストを維持したままスムーズに会話できます。",
            },
            {
              title: "柔軟なルーム管理",
              description:
                "プロジェクトやパートナー向けにルームを作成し、アクセス権や公開・非公開を細かく設定できます。",
            },
            {
              title: "翻訳履歴の保存",
              description:
                "過去の会話や翻訳をいつでも確認でき、情報の抜け漏れを防ぎます。",
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
            導入はとても簡単
          </p>
          <h2 className="mt-4 text-2xl font-semibold text-white">
            3 ステップでグローバル連携
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              {
                title: "アカウント登録またはログイン",
                description: "Supabase アカウントで数秒でサインインできます。",
              },
              {
                title: "ルームを作成",
                description: "ルーム名を設定し、メンバーを招待して言語を選択します。",
              },
              {
                title: "すぐにコラボレーション開始",
                description: "自然に入力するだけで即座に翻訳され、全員が理解できます。",
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
              いますぐ InterChat を始める
            </Link>
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">
              あらゆる業界で活躍
            </span>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-slate-950/60 py-10 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} InterChat. 世界中のチームのために設計されています。
      </footer>
    </main>
  );
}
