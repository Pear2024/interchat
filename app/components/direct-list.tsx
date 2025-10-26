'use client';

import { useMemo, useState, useTransition } from "react";
import { languageLabel } from "@/lib/chatTypes";
import { openDirectRoom } from "@/app/actions/open-direct-room";

type DirectListProps = {
  currentUserId: string;
  profiles: Array<{
    id: string;
    displayName: string;
    preferredLanguage: string;
  }>;
};

export default function DirectList({
  profiles,
}: DirectListProps) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredProfiles = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return profiles;
    return profiles.filter((profile) =>
      profile.displayName.toLowerCase().includes(keyword)
    );
  }, [profiles, query]);

  const handleStart = (targetId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await openDirectRoom(targetId);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-black/30 backdrop-blur-xl">
      <header>
        <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
          Direct messages
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">
          Start a one-on-one chat
        </h1>
        <p className="mt-3 text-sm text-slate-300">
          Select a member you want to talk to. The system will create a private room and take you there immediately.
        </p>
      </header>

      <div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ค้นหาชื่อสมาชิก…"
          className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-white/30 focus:outline-none"
        />
      </div>

      <div className="space-y-3">
        {filteredProfiles.length === 0 ? (
          <p className="text-sm text-slate-400">
            No accounts found matching your search, or you don&rsquo;t have any other members in the system yet.
          </p>
        ) : (
          filteredProfiles.map((profile) => (
            <div
              key={profile.id}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-white">
                  {profile.displayName}
                </p>
                <p className="text-xs text-slate-400">
                  Preferred language: {languageLabel(profile.preferredLanguage)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleStart(profile.id)}
                disabled={isPending}
                className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-white/30 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Creating…" : "Start DM"}
              </button>
            </div>
          ))
        )}
      </div>

      {error ? (
        <p className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}
