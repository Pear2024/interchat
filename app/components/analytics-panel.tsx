import { languageLabel } from "@/lib/chatTypes";

export type RoomAnalytics = {
  messageCount: number;
  translationCount: number;
  cacheHitRate: number;
  liveLatencyP50: number;
  liveLatencyP95: number;
  storageUsedMB: number;
  mostActiveLanguage: string;
};

export function AnalyticsPanel({
  analytics,
}: {
  analytics: RoomAnalytics | null;
}) {
  if (!analytics) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-5 text-sm text-slate-400">
        Loading analytics...
      </div>
    );
  }

  const cards = [
    {
      label: "Messages",
      value: analytics.messageCount.toLocaleString(),
      hint: "messages sent in the last 48 hours",
    },
    {
      label: "Translations",
      value: analytics.translationCount.toLocaleString(),
      hint: "translations generated",
    },
    {
      label: "Cache Hit Rate",
      value: `${Math.round(analytics.cacheHitRate * 100)}%`,
      hint: "translation cache accuracy",
    },
    {
      label: "Latency (P50)",
      value: `${analytics.liveLatencyP50.toFixed(1)} ms`,
      hint: "median translation latency",
    },
    {
      label: "Latency (P95)",
      value: `${analytics.liveLatencyP95.toFixed(1)} ms`,
      hint: "tail translation latency",
    },
    {
      label: "Storage",
      value: `${analytics.storageUsedMB.toFixed(1)} MB`,
      hint: "storage used (messages + files)",
    },
  ];

  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 px-6 py-6 shadow-lg shadow-black/30 backdrop-blur-xl">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Room Health</p>
        <h3 className="mt-2 text-2xl font-semibold text-white">Realtime Intelligence</h3>
        <p className="mt-1 text-sm text-slate-400">
          Most active language: {languageLabel(analytics.mostActiveLanguage)} ·
          Cache hit rate and latency updated every minute.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-white/10 bg-slate-950/40 px-5 py-6 shadow-inner shadow-black/20"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              {card.label}
            </p>
            <p className="mt-3 text-2xl font-semibold text-white">
              {card.value}
            </p>
            <p className="mt-1 text-xs text-slate-400">{card.hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
