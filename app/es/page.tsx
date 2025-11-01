import Link from "next/link";

export default function HomeSpanish() {
  const languages = [
    { href: "/", label: "ไทย", active: false },
    { href: "/en", label: "English", active: false },
    { href: "/ja", label: "日本語", active: false },
    { href: "/es", label: "Español", active: true },
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
          Colaboración global sin barreras idiomáticas
        </h1>
        <p className="mt-6 max-w-2xl text-base text-slate-300 sm:text-lg">
          InterChat conecta equipos distribuidos con traducción instantánea y una experiencia de chat intuitiva. Comunícate de forma natural sin importar el idioma de tus colegas.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/rooms"
            className="rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/40 transition hover:scale-[1.02]"
          >
            Abrir InterChat
          </Link>
          <Link
            href="/rooms"
            className="rounded-full border border-white/20 px-8 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5"
          >
            Iniciar sesión / Crear cuenta
          </Link>
        </div>
        <p className="mt-6 text-xs uppercase tracking-[0.35em] text-slate-500">
          Impulsa a tu equipo a expresarse en su idioma
        </p>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Conversaciones en tiempo real",
              description:
                "Colabora en múltiples idiomas con traducción neuronal inmediata y contexto preciso.",
            },
            {
              title: "Gestión flexible de salas",
              description:
                "Crea salas para proyectos, clientes o equipos y controla los permisos con detalle.",
            },
            {
              title: "Historial de traducciones",
              description:
                "Consulta conversaciones y traducciones pasadas cuando lo necesites para no perder información.",
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
            Comenzar es muy fácil
          </p>
          <h2 className="mt-4 text-2xl font-semibold text-white">
            3 pasos para colaborar sin límites
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Regístrate o inicia sesión",
                description: "Crea tu cuenta de InterChat o ingresa con Supabase en segundos.",
              },
              {
                title: "Crea una sala de colaboración",
                description:
                  "Ponle nombre a la sala, invita a tu equipo y define los idiomas predeterminados.",
              },
              {
                title: "Colabora de inmediato",
                description:
                  "Escribe o habla con naturalidad; InterChat traduce al instante para todos.",
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
              Comienza con InterChat
            </Link>
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Listo para cualquier industria
            </span>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-slate-950/60 py-10 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} InterChat. Diseñado para equipos globales.
      </footer>
    </main>
  );
}
