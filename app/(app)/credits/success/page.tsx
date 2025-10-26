import { redirect } from "next/navigation";
import { finalizeCheckout } from "@/app/actions/credits";

export default async function CreditSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string | null };
}) {
  const result = await finalizeCheckout(searchParams.session_id ?? null);

  if (result?.error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(circle_at_top,_#1b233a,_#090b12_55%)] px-6 py-10 text-slate-50">
        <div className="max-w-lg rounded-[32px] border border-rose-400/30 bg-rose-600/10 px-8 py-10 text-center shadow-[0_40px_80px_-30px_rgba(15,23,42,0.9)] backdrop-blur-xl">
          <h1 className="text-2xl font-semibold text-white">Payment issue</h1>
          <p className="mt-4 text-sm text-rose-200">{result.error}</p>
          <a
            href="/credits"
            className="mt-8 inline-flex rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/10"
          >
            Back to credits
          </a>
        </div>
      </div>
    );
  }

  if (!result?.success) {
    redirect("/credits");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(circle_at_top,_#1b233a,_#090b12_55%)] px-6 py-10 text-slate-50">
      <div className="max-w-lg rounded-[32px] border border-emerald-400/30 bg-emerald-500/10 px-8 py-10 text-center shadow-[0_40px_80px_-30px_rgba(15,23,42,0.9)] backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">
          Payment confirmed
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-white">
          Credits added successfully
        </h1>
        <p className="mt-4 text-sm text-slate-200">
          {result.alreadyProcessed
            ? "This checkout was already confirmed earlier. Your credits are ready to use."
            : `You received ${result.creditsAdded} credits from the ${result.packageName} package.`}
        </p>
        <a
          href="/credits"
          className="mt-8 inline-flex rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/10"
        >
          View credits
        </a>
      </div>
    </div>
  );
}
