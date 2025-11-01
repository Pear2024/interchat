'use client';

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { languageLabel } from "@/lib/chatTypes";
import { deleteOrLeaveRoom } from "@/app/actions/delete-room";

export type RoomOption = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  role: string | null;
  roomType?: string | null;
  hasUnread?: boolean;
  joinedAt?: string | null;
  lastSeenMessageAt?: string | null;
  lastMessageAt?: string | null;
};

export default function RoomSidebar({
  rooms,
  profile,
  analytics,
  isAdmin = false,
  isOwner = false,
  className,
}: {
  rooms: RoomOption[];
  profile: { name: string; language: string };
  analytics?: import("./analytics-panel").RoomAnalytics | null;
  isAdmin?: boolean;
  isOwner?: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const pathSegments = pathname.split("/").filter(Boolean);
  const activeSlug = pathSegments[pathSegments.length - 1];
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const canAccessManage = isAdmin || isOwner;
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const handleRoomContextMenu = (
    event: React.MouseEvent<HTMLAnchorElement, MouseEvent>,
    room: RoomOption
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (isPending) return;

    const isDemoRoom = room.slug === "global-collab";
    if (isDemoRoom) {
      setActionError("This room cannot be removed or left.");
      return;
    }

    const isOwnerOrAdmin = room.role === "owner" || room.role === "admin";
    const message = isOwnerOrAdmin
      ? `Delete the room “${room.name}” for everyone? This action cannot be undone.`
      : `Leave the room “${room.name}”? You will have to be invited again to rejoin.`;

    const confirmed = window.confirm(message);
    if (!confirmed) return;

    setPendingRoomId(room.id);
    setActionError(null);

    const isViewingRoom = activeSlug === room.slug;

    startTransition(async () => {
      const result = await deleteOrLeaveRoom(room.id);
      if (result?.error) {
        setActionError(result.error);
      } else {
        if (isViewingRoom) {
          router.push("/rooms");
        }
        router.refresh();
      }
      setPendingRoomId(null);
    });
  };
  const baseClasses =
    "w-72 flex h-full flex-col border-r border-white/10 bg-black/40 px-6 py-8 shadow-xl shadow-black/40 backdrop-blur-xl";
  const visibilityClasses = className ?? "hidden lg:flex";

  return (
    <aside className={`${visibilityClasses} ${baseClasses}`}>
      <div className="flex-1 space-y-8 overflow-y-auto pr-1">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Profile</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{profile.name}</h2>
          <p className="text-xs text-slate-400">
            Preferred language: {languageLabel(profile.language)}
          </p>
        </div>

        {analytics ? (
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Metrics</p>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-xs text-slate-300">
              <div className="flex items-center justify-between">
                <span>Messages</span>
                <span className="font-semibold text-white">{analytics.messageCount.toLocaleString()}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span>Cache hit</span>
                <span className="font-semibold text-emerald-300">{Math.round(analytics.cacheHitRate * 100)}%</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span>P50 latency</span>
                <span className="font-semibold">{analytics.liveLatencyP50.toFixed(0)} ms</span>
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Rooms</p>
          <Link
            href="/rooms/new"
            className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/15"
          >
            + Create room
          </Link>
          <Link
            href="/rooms/explore"
            className="mt-2 inline-flex w-full items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/10"
          >
            Browse open rooms
          </Link>
          <nav className="mt-3 space-y-2">
            {rooms.filter((room) => room.roomType !== "direct").length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-400">
                You are not a member of any group rooms yet.
              </div>
            ) : (
              rooms
                .filter((room) => room.roomType !== "direct")
                .map((room) => {
                  const isActive = activeSlug === room.slug;
                  return (
                    <Link
                      key={room.id}
                      href={`/rooms/${room.slug}`}
                      onContextMenu={(event) => handleRoomContextMenu(event, room)}
                      className={`block rounded-2xl border px-4 py-3 transition ${
                        isActive
                          ? "border-indigo-400/60 bg-indigo-500/20 text-white"
                          : "border-white/10 bg-white/5 text-slate-200 hover:border-white/30 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold">{room.name}</span>
                        <div className="flex items-center gap-2">
                          {room.hasUnread ? (
                            <span className="inline-flex h-2 w-2 animate-pulse items-center justify-center rounded-full bg-emerald-400 shadow shadow-emerald-400/40" />
                          ) : null}
                          {room.role ? (
                            <span className="text-[10px] uppercase tracking-[0.25em] text-slate-400">
                              {room.role}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {room.description ? (
                        <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                          {room.description}
                        </p>
                      ) : null}
                    </Link>
                  );
                })
            )}
          </nav>
        </div>

        <div className="mt-6 space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Direct messages</p>
          <Link
            href="/direct"
            className="inline-flex w-full items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/15"
          >
            + New direct message
          </Link>
          <nav className="mt-3 space-y-2">
            {rooms.filter((room) => room.roomType === "direct").length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-400">
                No conversations yet. Start a direct message.
              </div>
            ) : (
              rooms
                .filter((room) => room.roomType === "direct")
                .map((room) => {
                  const isActive = activeSlug === room.slug;
                  return (
                    <Link
                      key={room.id}
                      href={`/rooms/${room.slug}`}
                      onContextMenu={(event) => handleRoomContextMenu(event, room)}
                      className={`block rounded-2xl border px-4 py-3 transition ${
                        isActive
                          ? "border-rose-400/60 bg-rose-500/20 text-white"
                          : "border-white/10 bg-white/5 text-slate-200 hover:border-white/30 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold">{room.name}</span>
                        {room.hasUnread ? (
                          <span className="inline-flex h-2 w-2 animate-pulse items-center justify-center rounded-full bg-emerald-400 shadow shadow-emerald-400/40" />
                        ) : null}
                      </div>
                    </Link>
                  );
                })
            )}
          </nav>
        </div>

        <div className="mt-6 space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Account</p>
          <Link
            href="/dashboard"
            className={`block rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
              activeSlug === "dashboard"
                ? "border-sky-400/60 bg-sky-500/20 text-white"
                : "border-white/10 bg-white/5 text-slate-200 hover:border-white/30 hover:bg-white/10"
            }`}
          >
            Workspace dashboard
          </Link>
          <Link
            href="/credits"
            className={`block rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
              activeSlug === "credits"
                ? "border-sky-400/60 bg-sky-500/20 text-white"
                : "border-white/10 bg-white/5 text-slate-200 hover:border-white/30 hover:bg-white/10"
            }`}
          >
            Credits & billing
          </Link>
          <Link
            href="/voice"
            className={`block rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
              activeSlug === "voice"
                ? "border-sky-400/60 bg-sky-500/20 text-white"
                : "border-white/10 bg-white/5 text-slate-200 hover:border-white/30 hover:bg-white/10"
            }`}
          >
            Voice translator (PoC)
          </Link>
        </div>

        {(isAdmin || canAccessManage) ? (
          <div className="mt-6 space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Insights</p>
            {isAdmin ? (
              <Link
                href="/rooms/pricing"
                className={`block rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  activeSlug === "pricing"
                    ? "border-emerald-400/60 bg-emerald-500/20 text-white"
                    : "border-white/10 bg-white/5 text-slate-200 hover:border-white/30 hover:bg-white/10"
                }`}
              >
                Pricing dashboard
              </Link>
            ) : null}
            {canAccessManage ? (
              <Link
                href="/rooms/manage"
                className={`block rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  activeSlug === "manage"
                    ? "border-emerald-400/60 bg-emerald-500/20 text-white"
                    : "border-white/10 bg-white/5 text-slate-200 hover:border-white/30 hover:bg-white/10"
                }`}
              >
                Manage members
              </Link>
            ) : null}
          </div>
        ) : null}

        <Link
          href="/settings"
          className="mt-6 inline-flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/10"
        >
          <span>Settings</span>
          <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Language</span>
        </Link>

        <a
          href="mailto:ruttakorn78@me.com?subject=InterChat%20Bug%20Report"
          className="mt-4 inline-flex w-full items-center justify-between rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:border-rose-400/60 hover:bg-rose-500/20"
        >
          <span>Need Help</span>
          <span className="text-xs uppercase tracking-[0.3em] text-rose-200">Email</span>
        </a>
      </div>

      <button
        type="button"
        onClick={handleSignOut}
        className="mt-6 w-full rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/20"
      >
        Sign out
      </button>

      {isPending && pendingRoomId ? (
        <p className="mt-4 text-xs text-slate-400">
          {rooms.find((room) => room.id === pendingRoomId)?.role === "owner"
            ? "Deleting room…"
            : "Leaving room…"}
        </p>
      ) : null}
      {actionError ? (
        <p className="mt-2 text-xs font-medium text-rose-300">{actionError}</p>
      ) : null}
    </aside>
  );
}
