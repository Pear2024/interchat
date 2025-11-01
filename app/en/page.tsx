import Link from "next/link";

export default function HomeEnglish() {
  const languages = [
    { href: "/", label: "ไทย", active: false },
    { href: "/en", label: "English", active: true },
    { href: "/ja", label: "日本語", active: false },
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
          Global collaboration without language barriers
        </h1>
        <p className="mt-6 max-w-2xl text-base text-slate-300 sm:text-lg">
          InterChat keeps international teams in sync with real-time translation and an
          intuitive chat experience. Communicate naturally no matter what language your
          partners prefer.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/rooms"
            className="rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/40 transition hover:scale-[1.02]"
          >
            Launch InterChat
          </Link>
          <Link
            href="/rooms"
            className="rounded-full border border-white/20 px-8 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5"
          >
            Sign in / Create account
          </Link>
        </div>
        <p className="mt-6 text-xs uppercase tracking-[0.35em] text-slate-500">
          Empower every teammate to speak confidently
        </p>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Real-time conversations",
              description:
                "Collaborate in multiple languages simultaneously with instant neural translation tuned for teams.",
            },
            {
              title: "Flexible room management",
              description:
                "Spin up project rooms or private channels, control access, and lock conversations when needed.",
            },
            {
              title: "Translation history",
              description:
                "Review past discussions and translations anytime so nothing is lost between handoffs.",
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
            Getting started is simple
          </p>
          <h2 className="mt-4 text-2xl font-semibold text-white">
            3 steps to seamless teamwork
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Sign up or log in",
                description:
                  "Create your InterChat account or authenticate with Supabase in seconds.",
              },
              {
                title: "Create a room",
                description:
                  "Name your workspace, invite teammates, and choose default languages for the conversation.",
              },
              {
                title: "Start collaborating",
                description:
                  "Type or speak naturally while InterChat delivers instant translations to everyone in the room.",
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
              Start using InterChat
            </Link>
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Trusted across industries
            </span>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-slate-950/60 py-10 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} InterChat. Designed to bring global teams together.
      </footer>
    </main>
  );
}
