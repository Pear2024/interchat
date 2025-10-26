import { redirect } from "next/navigation";
import {
  getServerSupabaseClient,
  getServiceSupabaseClient,
} from "@/lib/supabaseServer";
import {
  estimateCostUSD,
  suggestPricePerCredit,
  formatCurrency,
  TOKENS_PER_CREDIT,
} from "@/lib/pricing";

const TARGET_MARGIN =
  Number.parseFloat(process.env.PRICING_TARGET_MARGIN ?? "0.6") || 0.6;
const FLOOR_PRICE = Number.parseFloat(
  process.env.PRICING_MIN_PRICE_PER_CREDIT ?? "0.01"
);
const LOOKBACK_DAYS = 30;

type UsageLogRow = {
  created_at: string;
  model_version: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  credits_charged: number | null;
  usage_type: string | null;
};

function formatNumber(value: number, fractionDigits = 0) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function PricingDashboardPage() {
  const supabase = await getServerSupabaseClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    redirect("/login");
  }

  const { data: ownerMembership } = await supabase
    .from("room_members")
    .select("role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!ownerMembership || ownerMembership.role !== "admin") {
    redirect("/rooms");
  }

  const since = new Date();
  since.setDate(since.getDate() - LOOKBACK_DAYS);

  const serviceClient = getServiceSupabaseClient();
  const { data: usageRows } = await serviceClient
    .from("translation_usage_logs")
    .select(
      "created_at, model_version, input_tokens, output_tokens, total_tokens, credits_charged, usage_type"
    )
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(500)
    .returns<UsageLogRow[]>();

  const logs = usageRows ?? [];

  let totalCostUsd = 0;
  let totalCredits = 0;
  let totalTokens = 0;
  let billableTranslations = 0;
  let lastTimestamp: string | null = null;

  const modelMap = new Map<
    string,
    {
      invocations: number;
      billable: number;
      credits: number;
      tokens: number;
      costUsd: number;
      lastUsed: string | null;
    }
  >();

  for (const row of logs) {
    const inputTokens = row.input_tokens ?? 0;
    const outputTokens = row.output_tokens ?? 0;
    const totalTokensForRow =
      row.total_tokens ??
      inputTokens + outputTokens;
    const credits = Number(row.credits_charged ?? 0);

    const { costUsd, normalizedModel } = estimateCostUSD({
      modelVersion: row.model_version,
      inputTokens,
      outputTokens,
    });

    totalCostUsd += costUsd;
    totalCredits += credits;
    totalTokens += totalTokensForRow;

    if (credits > 0) {
      billableTranslations += 1;
    }

    if (!lastTimestamp || row.created_at > lastTimestamp) {
      lastTimestamp = row.created_at;
    }

    const modelKey = normalizedModel || "unknown";
    const entry =
      modelMap.get(modelKey) ??
      {
        invocations: 0,
        billable: 0,
        credits: 0,
        tokens: 0,
        costUsd: 0,
        lastUsed: null,
      };

    entry.invocations += 1;
    if (credits > 0) {
      entry.billable += 1;
    }
    entry.credits += credits;
    entry.tokens += totalTokensForRow;
    entry.costUsd += costUsd;
    entry.lastUsed =
      !entry.lastUsed || row.created_at > entry.lastUsed
        ? row.created_at
        : entry.lastUsed;

    modelMap.set(modelKey, entry);
  }

  const costPerCredit = totalCredits > 0 ? totalCostUsd / totalCredits : 0;
  const priceSuggestion = suggestPricePerCredit({
    costPerCredit,
    targetMargin: TARGET_MARGIN,
    floorPrice: FLOOR_PRICE,
  });

  const profitIfRecommended =
    priceSuggestion.recommended * totalCredits - totalCostUsd;

  const avgCreditsPerTranslation =
    billableTranslations > 0 ? totalCredits / billableTranslations : 0;

  const avgTokensPerTranslation =
    billableTranslations > 0 ? totalTokens / billableTranslations : 0;

  const recommendedPricePerTranslation =
    billableTranslations > 0
      ? priceSuggestion.recommended * avgCreditsPerTranslation
      : 0;

  const modelRows = Array.from(modelMap.entries())
    .map(([model, stats]) => ({
      model,
      ...stats,
    }))
    .sort((a, b) => b.costUsd - a.costUsd);

  const lastUpdatedDisplay = lastTimestamp
    ? formatDate(lastTimestamp)
    : "No usage yet";

  return (
    <div className="flex min-h-screen justify-center bg-[radial-gradient(circle_at_top,_#1b233a,_#090b12_55%)] px-6 py-10 text-slate-50">
      <div className="w-full max-w-6xl space-y-8">
        <header className="rounded-[32px] border border-white/10 bg-white/5 px-8 py-8 shadow-[0_40px_80px_-30px_rgba(15,23,42,0.9)] backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
            Pricing Intelligence
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Translation cost & margin
          </h1>
          <p className="mt-3 text-sm text-slate-400">
            Data from the last {LOOKBACK_DAYS} days. Updated {lastUpdatedDisplay}.
            Use these numbers to tune your retail pricing and stay profitable.
          </p>
        </header>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <InsightCard
            title="Actual spend"
            primary={formatCurrency(totalCostUsd)}
            hint="Sum of OpenAI usage cost (estimated)"
          />
          <InsightCard
            title="Credits charged"
            primary={formatNumber(totalCredits, 0)}
            hint={`Credits deducted across ${billableTranslations} translations`}
          />
          <InsightCard
            title="Cost per credit"
            primary={
              costPerCredit > 0
                ? formatCurrency(costPerCredit)
                : formatCurrency(0)
            }
            hint={`1 credit ≈ ${TOKENS_PER_CREDIT.toLocaleString()} tokens`}
          />
          <InsightCard
            title="Recommended price"
            primary={formatCurrency(priceSuggestion.recommended)}
            hint={`Breakeven ${formatCurrency(
              priceSuggestion.breakeven
            )} · target margin ${(priceSuggestion.margin * 100).toFixed(0)}%`}
          />
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/30">
            <h2 className="text-xl font-semibold text-white">
              Profitability outlook
            </h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li>
                • If you charge{" "}
                <span className="font-semibold text-white">
                  {formatCurrency(priceSuggestion.recommended)}
                </span>{" "}
                per credit, projected profit over the last {LOOKBACK_DAYS} days
                would be{" "}
                <span
                  className={`font-semibold ${
                    profitIfRecommended >= 0
                      ? "text-emerald-300"
                      : "text-rose-300"
                  }`}
                >
                  {formatCurrency(profitIfRecommended)}
                </span>
                .
              </li>
              <li>
                • Average credits per translation:{" "}
                <span className="font-semibold text-white">
                  {formatNumber(avgCreditsPerTranslation || 0, 2)}
                </span>{" "}
                ({formatNumber(avgTokensPerTranslation || 0)} tokens).
              </li>
              <li>
                • Suggested retail price per translation (based on average
                usage):{" "}
                <span className="font-semibold text-white">
                  {formatCurrency(recommendedPricePerTranslation || 0)}
                </span>
                .
              </li>
              <li>
                • Premium tier? Try{" "}
                <span className="font-semibold text-white">
                  {formatCurrency(priceSuggestion.premium)}
                </span>{" "}
                per credit for high-touch customers.
              </li>
            </ul>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/30">
            <h2 className="text-xl font-semibold text-white">
              Pricing checklist
            </h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li>
                1. Decide how many credits to include in each plan (e.g. 1,000
                credits for hobby, 10,000 for business).
              </li>
              <li>
                2. Multiply credits by the recommended price above to set the
                retail cost. Keep breakeven price in mind when running promos.
              </li>
              <li>
                3. Monitor this dashboard weekly—if cost per credit creeps up,
                adjust your pricing or negotiate volume discounts.
              </li>
              <li>
                4. Communicate clearly: one credit ≈ one medium-length message
                (~{TOKENS_PER_CREDIT.toLocaleString()} tokens) so customers know
                what they’re buying.
              </li>
            </ul>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Model breakdown
              </h2>
              <p className="text-sm text-slate-400">
                Cost and credit usage per OpenAI model in the last {LOOKBACK_DAYS} days.
              </p>
            </div>
          </div>
          {modelRows.length === 0 ? (
            <p className="mt-6 text-sm text-slate-400">
              No translation usage recorded yet. Send some messages to populate
              this table.
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.3em] text-slate-500">
                    <th className="py-2 pr-4">Model</th>
                    <th className="px-4 py-2">Invocations</th>
                    <th className="px-4 py-2">Credits</th>
                    <th className="px-4 py-2">Tokens</th>
                    <th className="px-4 py-2">Spend</th>
                    <th className="px-4 py-2">Last used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {modelRows.map((row) => (
                    <tr key={row.model} className="text-slate-200">
                      <td className="py-3 pr-4 font-semibold text-white">
                        {row.model}
                      </td>
                      <td className="px-4 py-3">
                        {formatNumber(row.invocations, 0)}{" "}
                        <span className="text-xs text-slate-500">
                          ({formatNumber(row.billable, 0)} charged)
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {formatNumber(row.credits, 2)}
                      </td>
                      <td className="px-4 py-3">
                        {formatNumber(row.tokens, 0)}
                      </td>
                      <td className="px-4 py-3">
                        {formatCurrency(row.costUsd)}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {row.lastUsed ? formatDate(row.lastUsed) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function InsightCard({
  title,
  primary,
  hint,
}: {
  title: string;
  primary: string;
  hint: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-6 shadow-lg shadow-black/30">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
        {title}
      </p>
      <p className="mt-3 text-2xl font-semibold text-white">{primary}</p>
      <p className="mt-2 text-xs text-slate-400">{hint}</p>
    </div>
  );
}
