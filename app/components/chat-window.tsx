'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import {
  ChatMessage,
  SupabaseMessageRow,
  mapRowsToChatMessages,
  languageLabel,
} from "@/lib/chatTypes";
import { sendMessage } from "@/app/actions/send-message";

type ChatWindowProps = {
  initialMessages: ChatMessage[];
  roomId: string;
  roomName: string;
  roomDescription?: string | null;
  viewerLanguage: string;
  viewerProfileId?: string | null;
};

const MESSAGE_LIMIT = 50;

export default function ChatWindow({
  initialMessages,
  roomId,
  roomName,
  roomDescription,
  viewerLanguage,
  viewerProfileId = null,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isSyncing, setIsSyncing] = useState(false);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);

  const fetchLatestMessages = useCallback(async () => {
    if (!supabase) return;
    setIsSyncing(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select(
          `
            id,
            room_id,
            author_id,
            content,
            created_at,
            original_language,
            detected_language,
            profiles:author_id (
              display_name,
              preferred_language
            ),
            translations:message_translations (
              target_language,
              translated_text
            )
          `
        )
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })
        .limit(MESSAGE_LIMIT);

      if (!error && data) {
        setMessages(
          mapRowsToChatMessages(
            data as SupabaseMessageRow[],
            viewerLanguage,
            viewerProfileId
          )
        );
      }
    } finally {
      setIsSyncing(false);
    }
  }, [supabase, roomId, viewerLanguage, viewerProfileId]);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
    shouldAutoScrollRef.current = true;
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (!shouldAutoScrollRef.current) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 80;
  }, []);

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          fetchLatestMessages();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_translations",
        },
        () => {
          fetchLatestMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLatestMessages, roomId, supabase]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden px-6 pt-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">{roomName}</h2>
          <p className="text-sm text-slate-400">
            {roomDescription || "Realtime multilingual workspace"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300">
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-300">
              Live
            </span>
            <span>Translation cache 62%</span>
          </div>
          <button
            type="button"
            onClick={fetchLatestMessages}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-white/30 hover:text-white"
            disabled={isSyncing}
          >
            {isSyncing ? "Syncing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="mt-6 flex-1 space-y-6 overflow-y-auto pr-4 min-h-0 pb-6"
      >
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const { author, original, translation, timestamp } = message;
  const alignment = author.isSelf
    ? "flex-row-reverse text-right"
    : "flex-row text-left";
  const bubbleBg = author.isSelf
    ? "bg-white text-slate-900"
    : "bg-white/[0.08] text-slate-100 border border-white/10";
  const translationBg = author.isSelf
    ? "bg-slate-900/5 text-slate-600"
    : "bg-slate-900/60 text-slate-100";

  const originalLang = (original.language ?? "").toLowerCase();
  const translationLang = (translation.language ?? "").toLowerCase();
  const originalText = original.text.trim();
  const translationText = translation.text.trim();

  const sameLanguage =
    originalLang && translationLang && originalLang === translationLang;
  const duplicateText =
    translationText.length > 0 && translationText === originalText;
  const showTranslation =
    translationText.length > 0 && !sameLanguage && !duplicateText;

  return (
    <div className={`flex items-start gap-4 ${alignment}`}>
      <Avatar initials={author.initials} gradient={author.accent} />
      <div className="flex max-w-2xl flex-col gap-3">
        <div
          className={`relative w-full rounded-[26px] px-6 py-5 shadow-xl shadow-black/20 backdrop-blur ${bubbleBg}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-[0.35em] text-slate-500">
              {author.name.toUpperCase()}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white shadow-inner shadow-black/40">
              <span>{languageLabel(original.language)}</span>
              {showTranslation ? (
                <>
                  <span className="text-slate-400">→</span>
                  <span>{languageLabel(translation.language)}</span>
                </>
              ) : null}
            </span>
          </div>
          <div className="mt-2 text-lg font-semibold leading-7 text-current">
            {original.text}
          </div>
          {showTranslation ? (
            <div
              className={`mt-3 rounded-2xl px-4 py-3 text-sm leading-relaxed ${translationBg}`}
            >
              {translation.text}
            </div>
          ) : null}
        </div>
        <div
          className={`text-xs font-medium text-slate-400 ${
            author.isSelf ? "self-end" : "self-start"
          }`}
        >
          {timestamp}
        </div>
      </div>
    </div>
  );
}

function Avatar({
  initials,
  gradient,
}: {
  initials: string;
  gradient: string;
}) {
  return (
    <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-slate-900/40 shadow-lg shadow-black/40">
      <span
        className={`absolute inset-[2px] rounded-full bg-gradient-to-br ${gradient} opacity-80`}
      />
      <span className="relative text-sm font-semibold text-white uppercase">
        {initials}
      </span>
    </div>
  );
}

type ComposerProps = {
  roomId: string;
  viewerLanguage: string;
  authorId: string | null | undefined;
};

export function Composer({
  roomId,
  viewerLanguage,
  authorId,
}: ComposerProps) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isBlocked = !authorId;

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const value = content.trim();
      if (!value) return;

       if (!authorId) {
         setError("Please sign in before sending messages.");
         return;
       }

      setError(null);

      startTransition(async () => {
        const result = await sendMessage({
          content: value,
          targetLanguage: viewerLanguage,
          roomId,
          authorId: authorId ?? undefined,
        });

        if (result?.error) {
          setError(result.error);
        } else {
          setContent("");
          window.location.reload();
        }
      });
    },
    [authorId, content, roomId, viewerLanguage]
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="flex shrink-0 flex-col gap-4 px-6 py-6"
    >
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-slate-500">
        <span>Auto translation active</span>
        <span>Retention: 48 hours</span>
      </div>
      <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.08] p-3 shadow-inner shadow-black/30">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:border-white/40 hover:text-white"
        >
          <span className="sr-only">Attach file</span>
          <PaperclipIcon />
        </button>
        <input
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className="flex-1 bg-transparent text-base font-medium text-white placeholder:text-slate-400 focus:outline-none"
          placeholder="Type a message (we will translate for every participant)"
          disabled={isPending || isBlocked}
        />
        <button
          type="submit"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-xl shadow-indigo-500/40 transition hover:scale-105"
          disabled={isBlocked || isPending || !content.trim()}
        >
          <span className="sr-only">Send message</span>
          {isPending ? (
            <svg
              className="h-5 w-5 animate-spin text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
            >
              <path
                d="M12 4v2M12 18v2M4 12H2m20 0h-2M6.343 6.343l-1.414-1.414M19.071 19.071l-1.414-1.414M6.343 17.657l-1.414 1.414M19.071 4.929l-1.414 1.414"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <SendIcon />
          )}
        </button>
      </div>
      {isBlocked ? (
        <p className="text-xs text-amber-300">
          Sign in to start sending messages.
        </p>
      ) : error ? (
        <p className="text-xs font-medium text-rose-300">{error}</p>
      ) : (
        <p className="text-xs text-slate-500">
          Source language: auto-detect → Target: {languageLabel(viewerLanguage)}
        </p>
      )}
    </form>
  );
}

function PaperclipIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      className="h-5 w-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 11.5V17a6 6 0 1 1-12 0V7a4 4 0 1 1 8 0v9a2 2 0 1 1-4 0V8.5"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className="h-5 w-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 12h6m0 0 2 2m-2-2 2-2m7-7-9 9"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m21 3-6.6 17.6a1 1 0 0 1-1.8.1L8.7 13.3a1 1 0 0 1 .2-1.2L20.5 2.5A.5.5 0 0 1 21 3Z"
      />
    </svg>
  );
}
