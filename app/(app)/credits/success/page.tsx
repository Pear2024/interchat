import { finalizeCheckout } from "@/app/actions/credits";
import AutoRedirect from "@/app/components/auto-redirect";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CreditSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string | null };
}) {
  const sessionId = searchParams.session_id ?? null;
  let creditsAdded: number | undefined;
  let packageName: string | undefined;

  if (sessionId) {
    try {
      const result = await finalizeCheckout(sessionId);
      if (result?.success) {
        creditsAdded = result.creditsAdded;
        packageName = result.packageName;
      }
    } catch (error) {
      console.error("Failed to finalize checkout", error);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(circle_at_top,_#1b233a,_#090b12_55%)] px-6 py-10 text-slate-50">
      <AutoRedirect to="/credits" delay={3000} />
      <div className="max-w-lg rounded-[32px] border border-emerald-400/30 bg-emerald-500/10 px-8 py-10 text-center shadow-[0_40px_80px_-30px_rgba(15,23,42,0.9)] backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">
          Payment confirmed
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-white">
          Top-up completed successfully
        </h1>
        <p className="mt-4 text-sm text-slate-200">
          You will be redirected back to the credits dashboard in just a moment.
        </p>
        {creditsAdded ? (
          <p className="mt-2 text-sm text-emerald-100">
            +{creditsAdded.toLocaleString()} credits
            {packageName ? ` (${packageName})` : ""}
          </p>
        ) : null}
        <a
          href="/credits"
          className="mt-8 inline-flex rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/10"
        >
          Go to credits
        </a>
      </div>
    </div>
  );
}
