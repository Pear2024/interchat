'use client';

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinRoom } from "@/app/actions/join-room";

type OpenRoom = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  memberCount: number;
};

export default function OpenRoomExplorer({ rooms }: { rooms: OpenRoom[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredRooms = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return rooms;
    return rooms.filter((room) => {
      return (
        room.name.toLowerCase().includes(keyword) ||
        room.description?.toLowerCase().includes(keyword) ||
        room.slug.toLowerCase().includes(keyword)
      );
    });
  }, [rooms, query]);

  const handleJoin = (room: OpenRoom) => {
    setError(null);
    setPendingRoomId(room.id);
    startTransition(async () => {
      const result = await joinRoom(room.id);
      if (result && "error" in result) {
        setError(result.error);
        setPendingRoomId(null);
        return;
      }
      if (result && "slug" in result) {
        router.push(`/rooms/${result.slug}`);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-white">Browse open rooms</h1>
        <p className="text-sm text-slate-300">
          Join any public room that matches your interests. Locked rooms will not appear here.
        </p>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by room name or description…"
          className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-white/30 focus:outline-none"
        />
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filteredRooms.length === 0 ? (
          <p className="col-span-full rounded-3xl border border-white/10 bg-white/5 px-6 py-5 text-sm text-slate-300">
            No open rooms match your search right now.
          </p>
        ) : (
          filteredRooms.map((room) => (
            <article
              key={room.id}
              className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 p-6 text-slate-100 shadow-lg shadow-black/40 backdrop-blur"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">{room.name}</h2>
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
                    {room.slug}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200">
                  {room.memberCount} members
                </span>
              </div>
              {room.description ? (
                <p className="text-sm text-slate-300">{room.description}</p>
              ) : null}
              <button
                type="button"
                onClick={() => handleJoin(room)}
                disabled={isPending && pendingRoomId === room.id}
                className="mt-auto w-fit rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/40 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending && pendingRoomId === room.id ? "Joining…" : "Join room"}
              </button>
            </article>
          ))
        )}
      </section>

      {error ? (
        <p className="rounded-3xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}
