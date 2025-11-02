'use client';

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import {
  ChatMessage,
  SupabaseMessageRow,
  mapRowsToChatMessages,
  languageLabel,
  MessageAttachment,
} from "@/lib/chatTypes";
import { sendMessage } from "@/app/actions/send-message";

const MESSAGE_LIMIT = 50;
const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // 5MB

type ChatWindowProps = {
  initialMessages: ChatMessage[];
  roomId: string;
  roomName: string;
  roomDescription?: string | null;
  viewerLanguage: string;
  viewerProfileId?: string | null;
};

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
            metadata,
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
    <div className="flex h-[65vh] min-h-[320px] max-h-[720px] flex-col overflow-hidden px-4 pt-6 sm:px-6 sm:pt-8">
      <div className="hidden items-center justify-between lg:flex">
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
      <div className="mb-4 lg:hidden">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-500">About this room</p>
        <p className="mt-1 text-sm text-slate-300">
          {roomDescription || "Realtime multilingual workspace"}
        </p>
      </div>
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="mt-4 flex-1 space-y-5 overflow-y-auto pr-2 min-h-0 pb-4 sm:mt-6 sm:space-y-6 sm:pr-4 sm:pb-6"
      >
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const { author, original, translation, timestamp, attachments } = message;
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
    <div className={`flex items-start gap-3 sm:gap-4 ${alignment}`}>
      <Avatar initials={author.initials} gradient={author.accent} />
      <div
        className={`flex max-w-[82vw] flex-col gap-3 sm:max-w-2xl ${
          author.isSelf ? "items-end" : "items-start"
        }`}
      >
        <div
          className={`relative inline-flex max-w-full flex-col rounded-[24px] px-4 py-4 shadow-xl shadow-black/20 backdrop-blur sm:rounded-[26px] sm:px-6 sm:py-5 ${bubbleBg} ${
            author.isSelf ? "self-end" : "self-start"
          }`}
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
          <div className="mt-2 break-words text-lg font-semibold leading-7 text-current">
            {original.text}
          </div>
          {showTranslation ? (
            <div
              className={`mt-3 break-words rounded-2xl px-4 py-3 text-sm leading-relaxed ${translationBg}`}
            >
              {translation.text}
            </div>
          ) : null}
        </div>
        {attachments.length > 0 ? (
          <div
            className={`mt-3 flex flex-wrap gap-3 ${
              author.isSelf ? "justify-end" : "justify-start"
            }`}
          >
            {attachments.map((attachment) => (
              <a
                key={`${message.id}-${attachment.url}`}
                href={attachment.url}
                target="_blank"
                rel="noreferrer"
                className="group relative block h-32 w-32 overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg shadow-black/30 transition hover:border-white/30 hover:shadow-indigo-500/20 sm:h-36 sm:w-36"
              >
                <Image
                  src={attachment.url}
                  alt={attachment.name}
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 128px, 144px"
                  className="object-cover transition group-hover:scale-[1.03]"
                  loading="lazy"
                />
                <span className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1 text-[11px] font-medium text-white opacity-0 transition group-hover:opacity-100 line-clamp-1">
                  {attachment.name}
                </span>
              </a>
            ))}
          </div>
        ) : null}
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
    <div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-slate-900/40 shadow-lg shadow-black/40 sm:h-12 sm:w-12">
      <span
        className={`absolute inset-[2px] rounded-full bg-gradient-to-br ${gradient} opacity-80`}
      />
      <span className="relative text-xs font-semibold uppercase text-white sm:text-sm">
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
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<
    Array<
      MessageAttachment & {
        id: string;
        previewUrl: string;
      }
    >
  >([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isBlocked = !authorId;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const triggerFilePicker = useCallback(() => {
    if (isBlocked || isUploading || attachments.length >= MAX_ATTACHMENTS) {
      return;
    }
    fileInputRef.current?.click();
  }, [attachments.length, isBlocked, isUploading]);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const uploadAttachment = useCallback(
    async (file: File) => {
      setAttachmentError(null);
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("roomId", roomId);

        const response = await fetch("/api/attachments/upload", {
          method: "POST",
          body: formData,
        });

        const data = (await response.json().catch(() => null)) as
          | {
              url?: string;
              name?: string;
              type?: string;
              size?: number;
              error?: string;
            }
          | null;

        if (!response.ok || !data) {
          throw new Error(
            data?.error ?? "ไม่สามารถอัปโหลดไฟล์ได้ กรุณาลองใหม่อีกครั้ง"
          );
        }

        const url =
          data && typeof data.url === "string" && data.url.length > 0
            ? data.url
            : null;

        if (!url) {
          throw new Error("ไม่พบ URL ของไฟล์ที่อัปโหลด");
        }

        const name =
          data && typeof data.name === "string" && data.name.trim().length > 0
            ? data.name.trim()
            : file.name;
        const type =
          data && typeof data.type === "string" && data.type.length > 0
            ? data.type
            : file.type || null;
        const size =
          data && typeof data.size === "number" && Number.isFinite(data.size)
            ? data.size
            : file.size ?? null;

        const id = crypto.randomUUID();
        setAttachments((prev) => [
          ...prev,
          {
            id,
            url,
            name,
            type,
            size,
            previewUrl: url,
          },
        ]);
      } catch (uploadError) {
        console.error("Attachment upload failed", uploadError);
        setAttachmentError(
          uploadError instanceof Error
            ? uploadError.message
            : "ไม่สามารถอัปโหลดไฟล์ได้ กรุณาลองใหม่อีกครั้ง"
        );
      } finally {
        setIsUploading(false);
      }
    },
    [roomId]
  );

  const handleFileSelection = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (files.length === 0) {
        return;
      }

      const remainingSlots = MAX_ATTACHMENTS - attachments.length;
      if (remainingSlots <= 0) {
        setAttachmentError("คุณสามารถแนบรูปภาพได้สูงสุด 3 ไฟล์ต่อข้อความ");
        return;
      }

      for (const file of files.slice(0, remainingSlots)) {
        if (!file.type.startsWith("image/")) {
          setAttachmentError("รองรับเฉพาะไฟล์ภาพ (PNG, JPG, GIF, WebP)");
          continue;
        }
        if (file.size > MAX_ATTACHMENT_SIZE) {
          setAttachmentError("ขนาดไฟล์ต้องไม่เกิน 5 MB ต่อรูปภาพ");
          continue;
        }
        await uploadAttachment(file);
      }
    },
    [attachments.length, uploadAttachment]
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const value = content.trim();
      if (!value) {
        setError("Please type a message before sending.");
        return;
      }

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
          attachments: attachments.map(
            ({ url, name, type, size }) => ({
              url,
              name,
              contentType: type ?? undefined,
              size: size ?? undefined,
            })
          ),
        });

        if (result?.error) {
          setError(result.error);
        } else {
          setContent("");
          setAttachments([]);
          setAttachmentError(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
          window.location.reload();
        }
      });
    },
    [attachments, authorId, content, roomId, viewerLanguage]
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="flex shrink-0 flex-col gap-3 px-4 py-4 sm:gap-4 sm:px-6 sm:py-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] uppercase tracking-[0.3em] text-slate-500 sm:text-xs">
        <span>Auto translation active</span>
        <span>Retention: 48 hours (Automatic deletion)</span>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] p-3 shadow-inner shadow-black/30 sm:gap-3">
        <button
          type="button"
          onClick={triggerFilePicker}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:border-white/40 hover:text-white sm:h-10 sm:w-10"
          disabled={
            isBlocked || isUploading || attachments.length >= MAX_ATTACHMENTS
          }
        >
          <span className="sr-only">Attach image</span>
          {isUploading ? (
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
            <PaperclipIcon />
          )}
        </button>
        <input
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className="flex-1 bg-transparent text-sm font-medium text-white placeholder:text-slate-400 focus:outline-none sm:text-base"
          placeholder="Type a message (we will translate for every participant)"
          disabled={isPending || isBlocked}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileSelection}
        />
        <button
          type="submit"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-xl shadow-indigo-500/40 transition hover:scale-105 sm:h-12 sm:w-12"
          disabled={
            isBlocked ||
            isPending ||
            isUploading ||
            (!content.trim() && attachments.length === 0)
          }
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
      {attachments.length > 0 ? (
        <div className="flex flex-wrap gap-3 pl-1">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="relative h-20 w-20 overflow-hidden rounded-xl border border-white/10 bg-white/10 shadow-inner shadow-black/30 sm:h-24 sm:w-24"
            >
              <Image
                src={attachment.previewUrl}
                alt={attachment.name}
                fill
                unoptimized
                sizes="(max-width: 640px) 96px, 128px"
                className="object-cover"
                loading="lazy"
              />
              <button
                type="button"
                onClick={() => handleRemoveAttachment(attachment.id)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/70 text-xs font-semibold text-white shadow"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {isBlocked ? (
        <p className="text-xs text-amber-300">
          Sign in to start sending messages.
        </p>
      ) : (
        <>
          {error ? (
            <p className="text-xs font-medium text-rose-300">{error}</p>
          ) : (
            <p className="text-xs text-slate-500">
              Source language: auto-detect → Target:{" "}
              {languageLabel(viewerLanguage)}
            </p>
          )}
          {attachmentError ? (
            <p className="text-xs font-medium text-rose-200">
              {attachmentError}
            </p>
          ) : null}
        </>
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
