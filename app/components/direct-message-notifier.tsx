'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { RealtimePostgresInsertPayload } from "@supabase/realtime-js";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type DirectRoom = {
  id: string;
  slug: string;
  name: string;
};

type NotificationItem = {
  id: string;
  roomId: string;
  roomSlug: string;
  roomName: string;
  content: string;
};

type MessageRow = {
  id: string;
  room_id: string;
  author_id: string | null;
  content: string | null;
};

type DirectMessageNotifierProps = {
  viewerId: string;
  rooms: DirectRoom[];
};

const AUTO_DISMISS_MS = 8000;

export default function DirectMessageNotifier({
  viewerId,
  rooms,
}: DirectMessageNotifierProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const timeoutRegistry = useRef<Record<string, number>>({});

  useEffect(() => {
    return () => {
      const registrySnapshot = timeoutRegistry.current;
      Object.values(registrySnapshot).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      timeoutRegistry.current = {};
    };
  }, []);

  useEffect(() => {
    if (!supabase || rooms.length === 0) return;

    const roomIds = rooms.map((room) => room.id);
    const filter =
      roomIds.length === 1
        ? `room_id=eq.${roomIds[0]}`
        : `room_id=in.(${roomIds.map((id) => `"${id}"`).join(",")})`;

    const channel = supabase
      .channel("direct-message-notifier")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter,
        },
        (payload: RealtimePostgresInsertPayload<MessageRow>) => {
          const newMessage = payload.new as MessageRow;

          if (!newMessage?.id || !newMessage.room_id) {
            return;
          }

          if (newMessage.author_id === viewerId) {
            return;
          }

          const room = rooms.find((item) => item.id === newMessage.room_id);
          if (!room) {
            return;
          }

          const snippet = (newMessage.content ?? "").trim().slice(0, 160);
          const notification: NotificationItem = {
            id: newMessage.id,
            roomId: room.id,
            roomSlug: room.slug,
            roomName: room.name,
            content: snippet || "New message",
          };

          setNotifications((current) => {
            const exists = current.some((item) => item.id === notification.id);
            if (exists) return current;
            return [...current, notification];
          });

          const timeoutId = window.setTimeout(() => {
            setNotifications((current) =>
              current.filter((item) => item.id !== notification.id)
            );
            delete timeoutRegistry.current[notification.id];
          }, AUTO_DISMISS_MS);

          timeoutRegistry.current[notification.id] = timeoutId;
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [supabase, rooms, viewerId]);

  const handleDismiss = (id: string) => {
    const timeoutId = timeoutRegistry.current[id];
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      delete timeoutRegistry.current[id];
    }
    setNotifications((current) => current.filter((item) => item.id !== id));
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[1200] flex max-w-sm flex-col gap-3">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className="pointer-events-auto rounded-3xl border border-white/20 bg-slate-950/90 p-4 shadow-2xl shadow-black/50 backdrop-blur"
        >
          <div className="mb-2 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.3em] text-slate-400">
            <span>Direct message</span>
            <button
              type="button"
              className="text-slate-500 transition hover:text-white"
              onClick={() => handleDismiss(notification.id)}
            >
              X
            </button>
          </div>
          <div className="text-sm font-semibold text-white">
            {notification.roomName}
          </div>
          <p className="mt-1 text-sm text-slate-200">
            {notification.content}
          </p>
          <Link
            href={`/rooms/${notification.roomSlug}`}
            className="mt-3 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/40 hover:bg-white/20"
            onClick={() => handleDismiss(notification.id)}
          >
            Open chat
          </Link>
        </div>
      ))}
    </div>
  );
}
