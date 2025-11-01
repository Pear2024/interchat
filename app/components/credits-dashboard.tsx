'use client';

import { useState, useTransition } from "react";
import type { CreditPackage } from "@/lib/credits";
import { createCheckoutSession } from "@/app/actions/credits";

type CreditsDashboardProps = {
  balance: number;
  packages: CreditPackage[];
  userEmail?: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

export default function CreditsDashboard({
  balance,
  packages,
  userEmail,
}: CreditsDashboardProps) {
  const [isPending, startTransition] = useTransition();
  const [pendingPackageId, setPendingPackageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const handlePurchase = (packageId: string) => {
    setError(null);
    setPendingPackageId(packageId);
    startTransition(async () => {
      const result = await createCheckoutSession(packageId);
      if (result?.error) {
        setError(result.error);
        setPendingPackageId(null);
        return;
      }
      if (result?.url) {
        window.location.href = result.url;
      } else {
        setError("Unable to start checkout at the moment. Please try again.");
        setPendingPackageId(null);
      }
    });
  };

  return (
    <div className="flex min-h-screen justify-center bg-[radial-gradient(circle_at_top,_#1b233a,_#090b12_55%)] px-6 py-10 text-slate-50">
      <div className="flex w-full max-w-6xl flex-col gap-8">
        <header className="rounded-[32px] border border-white/10 bg-white/5 px-8 py-8 shadow-[0_40px_80px_-30px_rgba(15,23,42,0.9)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
            Account Credits
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Translation credits balance
          </h1>
          <p className="mt-3 text-sm text-slate-400">
            Credits are required for each machine translation call. One credit≈1,000
            tokens. Purchase a package below when your balance runs low.
          </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  if (window.history.length > 1) {
                    window.history.back();
                  } else {
                    window.location.href = "/rooms";
                  }
                }
              }}
              className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-white/40 hover:bg-white/20"
            >
              ← Back
            </button>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-4 text-center shadow-inner shadow-black/20">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
                Current balance
              </p>
              <p className="mt-2 text-4xl font-semibold text-white">
                {formatNumber(balance)}
              </p>
              <p className="text-xs text-slate-400">credits remaining</p>
            </div>
            {userEmail ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-4 shadow-inner shadow-black/20">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
                  Billing email
                </p>
                <p className="mt-2 font-semibold text-slate-200">{userEmail}</p>
                <p className="text-xs text-slate-400">
                  Receipts and checkout links will be sent here.
                </p>
              </div>
            ) : null}
          </div>
        </header>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-5">
          {packages.map((pkg) => (
            <article
              key={pkg.id}
              className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/30 backdrop-blur-xl"
            >
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
                  {pkg.name}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {formatNumber(pkg.credits)} credits
                </h2>
                <p className="text-sm text-slate-400">
                  ${pkg.priceUsd.toFixed(2)} {pkg.billingType === "subscription" ? pkg.cadence ?? "per month" : "one-time payment"}
                </p>
              </div>
              <ul className="space-y-2 text-sm text-slate-300">
                {pkg.description.map((line) => (
                  <li key={line}>• {line}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => handlePurchase(pkg.id)}
                disabled={isPending}
                className="mt-auto rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/40 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending && pendingPackageId === pkg.id ? "Redirecting…" : pkg.billingType === "subscription" ? "Subscribe" : "Purchase"}
              </button>
            </article>
          ))}
        </section>

        {error ? (
          <div className="rounded-3xl border border-rose-400/40 bg-rose-500/10 px-6 py-4 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300 shadow-lg shadow-black/30 backdrop-blur-xl">
          <h3 className="text-lg font-semibold text-white">Need help?</h3>
          <p className="mt-2">
            Credits renew automatically after you purchase a package. If you run
            into issues or need a custom plan, email{" "}
            <a
              className="underline"
              href="mailto:ruttakorn78@me.com"
            >
              ruttakorn78@me.com
            </a>{" "}
            and our team will get back to you shortly.
          </p>
        </section>
      </div>
    </div>
  );
}
