import { redirect } from "next/navigation";
import { ensureProfile } from "@/app/actions/ensure-profile";
import { getServerSupabaseClient, getServiceSupabaseClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ONLINE_THRESHOLD_MINUTES = 5;

type ProfileRow = {
  id: string;
};

type PresenceRow = {
  user_id: string | null;
  last_seen_message_at: string | null;
};

export default async function WorkspaceDashboardPage() {
  const supabase = await getServerSupabaseClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    redirect("/login");
  }

  await ensureProfile();

  const serviceClient = getServiceSupabaseClient();

  const [{ data: profileRows, error: profileError }, { data: presenceRows, error: presenceError }] =
    (await Promise.all([
      serviceClient.from("profiles").select("id"),
      serviceClient.from("room_members").select("user_id,last_seen_message_at"),
    ])) as [
      { data: ProfileRow[] | null; error: unknown },
      { data: PresenceRow[] | null; error: unknown }
    ];

  if (profileError) {
    console.error("Failed to load profiles for dashboard", profileError);
  }

  if (presenceError) {
    console.error("Failed to load presence data for dashboard", presenceError);
  }

  const totalMembers = profileRows?.length ?? 0;

  const lastSeenMap = new Map<string, number>();
  (presenceRows ?? []).forEach((row) => {
    if (!row.user_id || !row.last_seen_message_at) {
      return;
    }
    const timestamp = new Date(row.last_seen_message_at).getTime();
    const existing = lastSeenMap.get(row.user_id);
    if (!existing || timestamp > existing) {
      lastSeenMap.set(row.user_id, timestamp);
    }
  });

  const now = Date.now();
  const threshold = now - ONLINE_THRESHOLD_MINUTES * 60 * 1000;

  let onlineCount = 0;
  lastSeenMap.forEach((timestamp) => {
    if (timestamp >= threshold) {
      onlineCount += 1;
    }
  });

  const offlineCount = Math.max(totalMembers - onlineCount, 0);

  const cards = [
    {
      label: "Total members",
      value: totalMembers.toLocaleString(),
      hint: "Registered profiles across the workspace",
    },
    {
      label: "Online now",
      value: onlineCount.toLocaleString(),
      hint: `Seen within the last ${ONLINE_THRESHOLD_MINUTES} minutes`,
    },
    {
      label: "Offline",
      value: offlineCount.toLocaleString(),
      hint: "Currently inactive or no recent activity",
    },
  ];

  return (
    <div className="flex min-h-screen justify-center bg-[radial-gradient(circle_at_top,_#1b233a,_#090b12_55%)] px-6 py-12 text-slate-50">
      <div className="w-full max-w-5xl space-y-8 rounded-[32px] border border-white/10 bg-white/5 px-8 py-10 shadow-[0_40px_80px_-30px_rgba(15,23,42,0.9)] backdrop-blur-xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Workspace overview</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Member Dashboard</h1>
            <p className="mt-2 text-sm text-slate-300">
              Real-time snapshot of your Interchat workspace. Online status is determined by the most
              recent activity recorded in any room.
            </p>
          </div>
          <a
            href="/rooms"
            className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/20"
          >
            Back to rooms
          </a>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-3xl border border-white/10 bg-slate-950/40 px-6 py-6 shadow-inner shadow-black/30"
            >
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{card.label}</p>
              <p className="mt-3 text-3xl font-semibold text-white">{card.value}</p>
              <p className="mt-2 text-xs text-slate-400">{card.hint}</p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-950/50 px-6 py-6 shadow-inner shadow-black/30">
          <h2 className="text-lg font-semibold text-white">Presence methodology</h2>
          <p className="mt-2 text-sm text-slate-300">
            Members are considered <span className="text-emerald-300">online</span> when their most recent
            activity timestamp (<code>last_seen_message_at</code>) is within the last{" "}
            {ONLINE_THRESHOLD_MINUTES} minutes. Otherwise they are categorised as offline. Members who have
            never joined a room are counted as offline until they send their first message.
          </p>
        </section>
      </div>
    </div>
  );
}
