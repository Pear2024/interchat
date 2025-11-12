'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

class InsufficientCreditsError extends Error {
  constructor(
    message: string,
    info?: { remainingCredits?: number | null; requiredCredits?: number | null }
  ) {
    super(message);
    this.name = "InsufficientCreditsError";
    this.remainingCredits =
      typeof info?.remainingCredits === "number" ? info.remainingCredits : null;
    this.requiredCredits =
      typeof info?.requiredCredits === "number" ? info.requiredCredits : null;
  }

  remainingCredits: number | null;
  requiredCredits: number | null;
}

type PendingChunk = {
  id: string;
  text: string;
  createdAt: number;
  status: "final";
};

type Transcript = {
  id: string;
  original: string;
  translated: string;
  sourceLanguage: string;
  timestamp: string;
  createdAt: number;
  status: "interim" | "final";
};

const MAX_PARALLEL_TRANSLATIONS = 3;
const RECORDING_TIMESLICE_MS = 4_000;

const INPUT_LANGUAGE_OPTIONS = [
  { value: "th-TH", label: "Thai" },
  { value: "en-US", label: "English" },
  { value: "he-IL", label: "Hebrew" },
  { value: "es-ES", label: "Spanish" },
  { value: "fil-PH", label: "Tagalog" },
  { value: "el-GR", label: "Greek" },
  { value: "jp-JP", label: "Japanese" },
  { value: "zh-CN", label: "Chinese" },
];

export default function VoiceTranslator({
  targetLanguage,
}: {
  targetLanguage: string;
}) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputLanguage, setInputLanguage] = useState<string>("th-TH");
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [interimSegments, setInterimSegments] = useState<Transcript[]>([]);
  const [liveOriginal, setLiveOriginal] = useState("");
  const [isTranslatingLive, setIsTranslatingLive] = useState(false);
  const [fontSize, setFontSize] = useState(28);
  const [showOriginal, setShowOriginal] = useState(true);
  const [showTranslationHistory, setShowTranslationHistory] = useState(true);
  const [displayedNarrative, setDisplayedNarrative] = useState("");
  const [pendingQueue, setPendingQueue] = useState<PendingChunk[]>([]);
  const [isFloatingWindow, setIsFloatingWindow] = useState(false);
  const [floatingPosition, setFloatingPosition] = useState<{ x: number; y: number }>({ x: 32, y: 32 });
  const [isDragging, setIsDragging] = useState(false);
  const floatingRef = useRef<HTMLDivElement | null>(null);
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveOriginalRef = useRef<string>("");
  const interimDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayedNarrativeRef = useRef("");
  const isTranslatingLiveRef = useRef(false);
  const narrativeLengthRef = useRef(0);
  const translationQueueRef = useRef<PendingChunk[]>([]);
  const activeTranslationsRef = useRef(0);
  const activeTranscriptionsRef = useRef(0);
  const uploadQueueRef = useRef<Promise<void>>(Promise.resolve());
  const chunkStartRef = useRef<number | null>(null);
  const scheduleTranslationsRef = useRef<(() => void) | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const latestSnapshotRef = useRef<{
    liveOriginal: string;
    liveTranslation: string;
    isTranslating: boolean;
    transcripts: Transcript[];
    pendingQueue: PendingChunk[];
    updatedAt: number;
  } | null>(null);
  const viewerWindowRef = useRef<Window | null>(null);
  const [isExternalViewerSupported] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    return typeof BroadcastChannel !== "undefined";
  });
  const [isBroadcastReady, setIsBroadcastReady] = useState(false);

  const clampPosition = useCallback((x: number, y: number) => {
    if (typeof window === "undefined") {
      return { x, y };
    }
    const maxX = Math.max(0, window.innerWidth - 420);
    const maxY = Math.max(0, window.innerHeight - 280);
    return {
      x: Math.min(Math.max(x, 16), maxX),
      y: Math.min(Math.max(y, 16), maxY),
    };
  }, []);

  const handleFloatingPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!isDragging) return;
      const next = clampPosition(
        event.clientX - dragOffsetRef.current.x,
        event.clientY - dragOffsetRef.current.y
      );
      setFloatingPosition(next);
    },
    [clampPosition, isDragging]
  );

  const handleFloatingPointerUp = useCallback(() => {
    setIsDragging(false);
    window.removeEventListener("pointermove", handleFloatingPointerMove);
    window.removeEventListener("pointerup", handleFloatingPointerUp);
  }, [handleFloatingPointerMove]);
  const originalHistory = useMemo(
    () => [...interimSegments, ...transcripts].sort((a, b) => b.createdAt - a.createdAt),
    [interimSegments, transcripts]
  );
  const translationHistory = useMemo(
    () => [...transcripts].sort((a, b) => b.createdAt - a.createdAt),
    [transcripts]
  );
  const finalNarrative = useMemo(() => {
    const ordered = [...transcripts]
      .filter((item) => item.status === "final")
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((item) => item.translated.trim())
      .filter(Boolean);
    return ordered.join("\n\n");
  }, [transcripts]);
  const liveNarrative = useMemo(() => {
    if (transcripts.length === 0) {
      return displayedNarrative;
    }
    const latestFinal = transcripts.find((item) => item.status === "final");
    return latestFinal?.translated ?? displayedNarrative;
  }, [displayedNarrative, transcripts]);

  useEffect(() => {
    displayedNarrativeRef.current = displayedNarrative;
  }, [displayedNarrative]);

  useEffect(() => {
    isTranslatingLiveRef.current = isTranslatingLive;
  }, [isTranslatingLive]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      if (!isFloatingWindow) return;
      setFloatingPosition((prev) => {
        const maxX = Math.max(0, window.innerWidth - 420);
        const maxY = Math.max(0, window.innerHeight - 280);
        return {
          x: Math.min(Math.max(prev.x, 16), maxX),
          y: Math.min(Math.max(prev.y, 16), maxY),
        };
      });
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [isFloatingWindow]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const target = finalNarrative;
    const current = displayedNarrativeRef.current;

    if (!target) {
      if (current) {
        displayedNarrativeRef.current = "";
        setDisplayedNarrative("");
      }
      return;
    }

    let startingText = current;
    if (!target.startsWith(current)) {
      startingText = "";
      displayedNarrativeRef.current = "";
      setDisplayedNarrative("");
    }

    let index = startingText.length;
    if (index >= target.length) {
      return;
    }

    let timeoutId: number | null = null;
    let cancelled = false;

    const typeNext = () => {
      if (cancelled) return;
      index += 1;
      const next = target.slice(0, index);
      displayedNarrativeRef.current = next;
      setDisplayedNarrative(next);
      if (index < target.length) {
        timeoutId = window.setTimeout(typeNext, 12);
      }
    };

    timeoutId = window.setTimeout(typeNext, 24);

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [finalNarrative]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const currentLength = displayedNarrative.length;
    if (currentLength <= narrativeLengthRef.current) {
      narrativeLengthRef.current = currentLength;
      return;
    }
    narrativeLengthRef.current = currentLength;

    window.requestAnimationFrame(() => {
      const doc = document.documentElement;
      const body = document.body;
      const scrollHeight = Math.max(
        doc?.scrollHeight ?? 0,
        body?.scrollHeight ?? 0
      );
      window.scrollTo({
        top: scrollHeight,
        behavior: "smooth",
      });
    });
  }, [displayedNarrative]);

  useEffect(() => {
    if (!isExternalViewerSupported || typeof window === "undefined") {
      setIsBroadcastReady(false);
      return;
    }
    const channel = new BroadcastChannel("voice-translator");
    broadcastChannelRef.current = channel;
    setIsBroadcastReady(true);

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data?.type === "request_latest" && latestSnapshotRef.current) {
        channel.postMessage({ type: "state", payload: latestSnapshotRef.current });
      }
    };

    channel.addEventListener("message", handleMessage);

    return () => {
      channel.removeEventListener("message", handleMessage);
      channel.close();
      broadcastChannelRef.current = null;
    };
  }, [isExternalViewerSupported]);

  useEffect(() => {
    if (!broadcastChannelRef.current) return;
    const snapshot = {
      liveOriginal,
      liveTranslation: liveNarrative,
      isTranslating: isTranslatingLive,
      transcripts,
      pendingQueue,
      updatedAt: Date.now(),
    };
    latestSnapshotRef.current = snapshot;
    broadcastChannelRef.current.postMessage({ type: "state", payload: snapshot });
  }, [isTranslatingLive, liveNarrative, liveOriginal, pendingQueue, transcripts]);

  const stopLiveInterval = useCallback(() => {
    if (liveIntervalRef.current) {
      clearInterval(liveIntervalRef.current);
      liveIntervalRef.current = null;
    }
  }, []);

  const stopRecorderTracks = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // ignore stop errors
      }
    }
    mediaRecorderRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore track stop errors
        }
      });
      mediaStreamRef.current = null;
    }
  }, []);

  const updateQueueState = useCallback(() => {
    setPendingQueue([...translationQueueRef.current]);
  }, []);

  const translateSegment = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return null;
      }

      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, targetLanguage }),
      });

      if (response.status === 402) {
        const payload = (await response.json().catch(() => null)) as
          | {
              error?: string;
              remainingCredits?: number;
              requiredCredits?: number;
            }
          | null;

        throw new InsufficientCreditsError(
          payload?.error ?? "Not enough credits to translate. Please top up your balance.",
          {
            remainingCredits: payload?.remainingCredits ?? null,
            requiredCredits: payload?.requiredCredits ?? null,
          }
        );
      }

      if (!response.ok) {
        throw new Error(`แปลไม่สำเร็จ (${response.status})`);
      }

      const payload = (await response.json()) as {
        sourceLanguage: string;
        translation: string;
      };

      return {
        source: trimmed,
        translation: payload.translation ?? trimmed,
        detected: payload.sourceLanguage ?? "unknown",
      };
    },
    [targetLanguage]
  );

  const syncTranslatingState = useCallback(() => {
    const shouldBeActive =
      activeTranslationsRef.current > 0 ||
      activeTranscriptionsRef.current > 0;
    if (isTranslatingLiveRef.current !== shouldBeActive) {
      isTranslatingLiveRef.current = shouldBeActive;
      setIsTranslatingLive(shouldBeActive);
    }
  }, []);

  const runTranslation = useCallback(
    async (item: PendingChunk) => {
      activeTranslationsRef.current += 1;
      syncTranslatingState();
      updateQueueState();

      let shouldPause = false;

      try {
        const result = await translateSegment(item.text);
        const translated = result?.translation?.trim() || item.text;
        const entry: Transcript = {
          id: item.id,
          original: item.text,
          translated,
          sourceLanguage: result?.detected ?? "unknown",
          timestamp: new Date(item.createdAt).toLocaleTimeString(),
          createdAt: item.createdAt,
          status: item.status,
        };

        setError(null);
        setLiveOriginal(item.text);
        setInterimSegments((current) =>
          current.filter((segment) => segment.id !== entry.id)
        );
        setTranscripts((current) => [entry, ...current]);
      } catch (error) {
        if (error instanceof InsufficientCreditsError) {
          translationQueueRef.current.unshift(item);
          updateQueueState();
          setError(error.message);
          stopRecorderTracks();
          stopLiveInterval();
          setIsListening(false);
          shouldPause = true;
        } else {
          const entry: Transcript = {
            id: item.id,
            original: item.text,
            translated: "(translation unavailable)",
            sourceLanguage: "unknown",
            timestamp: new Date(item.createdAt).toLocaleTimeString(),
            createdAt: item.createdAt,
            status: item.status,
          };

          if (item.status === "final") {
            setLiveOriginal(item.text);
          }

          setTranscripts((current) => [entry, ...current]);
          setInterimSegments((current) =>
            current.filter((segment) => segment.id !== entry.id)
          );
          setError(
            error instanceof Error ? error.message : "ไม่สามารถแปลได้"
          );
        }
      } finally {
        activeTranslationsRef.current = Math.max(0, activeTranslationsRef.current - 1);
        syncTranslatingState();
        updateQueueState();
        if (!shouldPause) {
          queueMicrotask(() => {
            scheduleTranslationsRef.current?.();
          });
        }
      }
    },
    [setIsListening, stopLiveInterval, stopRecorderTracks, syncTranslatingState, translateSegment, updateQueueState]
  );

  const scheduleTranslations = useCallback(() => {
    if (activeTranslationsRef.current >= MAX_PARALLEL_TRANSLATIONS) {
      return;
    }

    while (
      activeTranslationsRef.current < MAX_PARALLEL_TRANSLATIONS &&
      translationQueueRef.current.length > 0
    ) {
      const nextItem = translationQueueRef.current.shift();
      if (!nextItem) {
        break;
      }
      updateQueueState();
      void runTranslation(nextItem);
    }
  }, [runTranslation, updateQueueState]);

  useEffect(() => {
    scheduleTranslationsRef.current = scheduleTranslations;
    return () => {
      scheduleTranslationsRef.current = null;
    };
  }, [scheduleTranslations]);

  const enqueueTranslation = useCallback(
    (text: string): string | null => {
      const trimmed = text.trim();
      if (!trimmed) return null;

      const createdAt = Date.now();
      const item: PendingChunk = {
        id: `${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
        text: trimmed,
        createdAt,
        status: "final",
      };

      translationQueueRef.current.push(item);
      updateQueueState();

      scheduleTranslations();
      return item.id;
    },
    [scheduleTranslations, updateQueueState]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canRecordAudio =
      typeof window.MediaRecorder !== "undefined" &&
      typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia === "function";
    setIsSupported(canRecordAudio);
    if (!canRecordAudio) {
      setError("เบราว์เซอร์นี้ไม่รองรับการอัดเสียงสำหรับการถอดคำพูด");
    }
  }, []);

  const resetLivePreview = useCallback(
    ({ keepDisplay = false }: { keepDisplay?: boolean } = {}) => {
      stopLiveInterval();
      if (!keepDisplay) {
        setLiveOriginal("");
      }
      if (interimDebounceRef.current) {
        clearTimeout(interimDebounceRef.current);
        interimDebounceRef.current = null;
      }
      isTranslatingLiveRef.current = false;
      setIsTranslatingLive(false);
      liveOriginalRef.current = "";
      setInterimSegments([]);
      chunkStartRef.current = null;
    },
    [stopLiveInterval]
  );

  const stopListening = useCallback(() => {
    stopRecorderTracks();
    chunkStartRef.current = null;
    setIsListening(false);
    resetLivePreview({ keepDisplay: true });
  }, [resetLivePreview, stopRecorderTracks]);

  const handleFinalTranscript = useCallback(
    (text: string): string | null => {
      const trimmed = text.trim();
      if (!trimmed) return null;

      if (interimDebounceRef.current) {
        clearTimeout(interimDebounceRef.current);
        interimDebounceRef.current = null;
      }
      setLiveOriginal(trimmed);
      liveOriginalRef.current = trimmed;
      setInterimSegments([]);
      return enqueueTranslation(trimmed);
    },
    [enqueueTranslation]
  );

  const processAudioChunk = useCallback(
    async (blob: Blob, durationMs: number) => {
      if (!blob || blob.size === 0) {
        return;
      }

      activeTranscriptionsRef.current += 1;
      syncTranslatingState();

      try {
        const formData = new FormData();
        formData.append("audio", blob, `chunk-${Date.now()}.webm`);
        if (Number.isFinite(durationMs) && durationMs > 0) {
          formData.append(
            "durationMs",
            Math.max(0, Math.round(durationMs)).toString()
          );
        }

        formData.append("language", inputLanguage);

        const response = await fetch("/api/voice/transcribe", {
          method: "POST",
          body: formData,
        });

        if (response.status === 402) {
          const payload = (await response.json().catch(() => null)) as
            | {
                error?: string;
                remainingCredits?: number;
                requiredCredits?: number;
              }
            | null;

          setError(
            payload?.error ??
              "ไม่เพียงพอสำหรับถอดเสียง กรุณาเติมเครดิตแล้วลองใหม่"
          );
          stopRecorderTracks();
          setIsListening(false);
          resetLivePreview({ keepDisplay: true });
          return;
        }

        if (!response.ok) {
          const errorPayload = (await response.json().catch(() => null)) as
            | { error?: string; detail?: string }
            | null;
          const message =
            errorPayload?.detail ??
            errorPayload?.error ??
            `ถอดเสียงไม่สำเร็จ (${response.status})`;
          throw new Error(message);
        }

        const payload = (await response.json()) as {
          text?: string;
          language?: string | null;
        };

        const text = payload.text?.trim();
        if (text) {
          setError(null);
          const entryId = handleFinalTranscript(text);
          if (entryId) {
            const createdAt = Date.now();
            setInterimSegments([
              {
                id: entryId,
                original: text,
                translated: "",
                sourceLanguage: (payload.language ?? "unknown") || "unknown",
                timestamp: new Date(createdAt).toLocaleTimeString(),
                createdAt,
                status: "interim",
              },
            ]);
          }
        }
      } catch (chunkError) {
        console.error("Transcription chunk error", chunkError);
        setError(
          chunkError instanceof Error
            ? chunkError.message
            : "ถอดเสียงไม่สำเร็จ"
        );
      } finally {
        activeTranscriptionsRef.current = Math.max(
          0,
          activeTranscriptionsRef.current - 1
        );
        syncTranslatingState();
      }
    },
    [
      handleFinalTranscript,
      inputLanguage,
      resetLivePreview,
      stopRecorderTracks,
      setError,
      setIsListening,
      syncTranslatingState,
    ]
  );

  const queueAudioChunkUpload = useCallback(
    (blob: Blob, durationMs: number) => {
      if (!blob || blob.size === 0) {
        return;
      }

      uploadQueueRef.current = uploadQueueRef.current
        .catch(() => undefined)
        .then(() => processAudioChunk(blob, durationMs));
    },
    [processAudioChunk]
  );

  const handleFloatingPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isFloatingWindow) return;
      const rect = floatingRef.current?.getBoundingClientRect();
      if (!rect) return;
      dragOffsetRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      setIsDragging(true);
      window.addEventListener("pointermove", handleFloatingPointerMove);
      window.addEventListener("pointerup", handleFloatingPointerUp);
    },
    [handleFloatingPointerMove, handleFloatingPointerUp, isFloatingWindow]
  );

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handleFloatingPointerMove);
      window.removeEventListener("pointerup", handleFloatingPointerUp);
    };
  }, [handleFloatingPointerMove, handleFloatingPointerUp]);

  const renderTranslationPanel = useCallback(
    (detached: boolean) => (
      <section
        className={`flex h-full w-full flex-col space-y-4 rounded-3xl border border-white/10 bg-slate-950/40 px-6 py-6 shadow-inner shadow-black/30 ${
          detached ? "cursor-move" : ""
        }`}
      >
        <header
          className="flex items-center justify-between"
          onPointerDown={detached ? handleFloatingPointerDown : undefined}
        >
          <div>
            <h3 className="text-lg font-semibold text-white">คำแปลล่าสุด</h3>
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Target: {targetLanguage.toUpperCase()}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (detached) {
                setIsFloatingWindow(false);
              } else {
                setIsFloatingWindow(true);
              }
            }}
            className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:border-white/40 hover:bg-white/20"
          >
            {detached ? "Dock window" : "Pop out"}
          </button>
        </header>
        <div className="min-h-[200px] rounded-2xl border border-white/10 bg-slate-950/60 px-5 py-4 shadow-inner shadow-black/20">
          {liveNarrative ? (
            <p
              className="font-semibold text-emerald-100 whitespace-pre-wrap"
              style={{ fontSize: `${fontSize}px`, lineHeight: 1.35 }}
            >
              {liveNarrative}
            </p>
          ) : (
            <p className="text-sm text-slate-500">ระบบจะแปลและแสดงผลอัตโนมัติ</p>
          )}
        </div>
        {pendingQueue.length > 0 ? (
          <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
            <p className="uppercase tracking-[0.3em] text-amber-200/80">คิวรอแปล</p>
            <ul className="mt-2 space-y-1 text-amber-100/90">
              {pendingQueue.map((item) => (
                <li key={item.id} className="truncate">
                  {new Date(item.createdAt).toLocaleTimeString()} · {item.text}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-xs text-slate-300">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">แสดงพร้อมกัน</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">
            {liveOriginal}
          </p>
          <hr className="my-3 border-white/10" />
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">
            Translation
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-200">
            {liveNarrative || ""}
          </p>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">ประวัติ (คำแปล)</p>
            <button
              type="button"
              onClick={() => setShowTranslationHistory((value) => !value)}
              className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-emerald-100 transition hover:border-white/30 hover:bg-white/15"
            >
              {showTranslationHistory ? "ซ่อน" : "แสดง"}
            </button>
          </div>
          {showTranslationHistory ? (
            translationHistory.length === 0 ? (
              <p className="text-sm text-slate-400">
                เมื่อมีการแปลแล้ว ข้อความจะปรากฏที่นี่ตามลำดับเวลา
              </p>
            ) : (
              <ul className="space-y-3">
                {translationHistory.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
                  >
                    <div className="flex items-center justify-between text-xs text-emerald-200/80">
                      <span>{item.timestamp}</span>
                      <span>
                        {item.sourceLanguage.toUpperCase()}-&gt;{targetLanguage.toUpperCase()}
                      </span>
                    </div>
                    <p
                      className="mt-2 font-semibold"
                      style={{ fontSize: `${Math.max(fontSize - 6, 16)}px`, lineHeight: 1.35 }}
                    >
                      {item.translated}
                    </p>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <p className="text-xs text-slate-500">ประวัติคำแปลถูกซ่อนอยู่</p>
          )}
        </div>
      </section>
    ),
    [
      fontSize,
      handleFloatingPointerDown,
      liveNarrative,
      liveOriginal,
      pendingQueue,
      setShowTranslationHistory,
      showTranslationHistory,
      targetLanguage,
      translationHistory,
    ]
  );

  const openExternalViewer = useCallback(() => {
    if (typeof window === "undefined") return;
    const viewerUrl = new URL("/voice/viewer", window.location.origin);
    const popup = window.open(
      viewerUrl.toString(),
      "voice-translator-viewer",
      "width=520,height=720,resizable=yes,scrollbars=yes"
    );
    if (!popup) {
      setError("เบราว์เซอร์ปิดกั้นหน้าต่างป๊อปอัป กรุณาอนุญาตแล้วลองใหม่");
      return;
    }
    viewerWindowRef.current = popup;
    popup.focus();
    setError(null);
  }, []);

  const startListening = useCallback(async () => {
    if (!isSupported) {
      setError("เบราว์เซอร์นี้ไม่รองรับการอัดเสียง");
      return;
    }

    if (
      typeof navigator === "undefined" ||
      typeof MediaRecorder === "undefined" ||
      typeof navigator.mediaDevices?.getUserMedia !== "function"
    ) {
      setIsSupported(false);
      setError("เบราว์เซอร์นี้ไม่รองรับการอัดเสียง");
      return;
    }

    setError(null);
    resetLivePreview();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const mimeCandidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ];
      const supportedMime =
        typeof MediaRecorder.isTypeSupported === "function"
          ? mimeCandidates.find((candidate) =>
              MediaRecorder.isTypeSupported(candidate)
            )
          : undefined;

      const recorder = new MediaRecorder(stream, {
        mimeType: supportedMime || undefined,
      });

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.addEventListener("dataavailable", (event: BlobEvent) => {
        if (!event.data || event.data.size === 0) {
          return;
        }
        const now = performance.now();
        const startedAt = chunkStartRef.current ?? now;
        const duration = Math.max(250, now - startedAt);
        chunkStartRef.current = now;
        queueAudioChunkUpload(event.data, duration);
      });

      recorder.addEventListener("stop", () => {
        chunkStartRef.current = null;
        setIsListening(false);
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => {
            try {
              track.stop();
            } catch {
              // ignore stop errors
            }
          });
          mediaStreamRef.current = null;
        }
        mediaRecorderRef.current = null;
      });

      recorder.addEventListener("error", (event) => {
        console.error("MediaRecorder error", event);
        setError("เกิดข้อผิดพลาดในการอัดเสียง");
        setIsListening(false);
        resetLivePreview({ keepDisplay: true });
      });

      chunkStartRef.current = performance.now();
      recorder.start(RECORDING_TIMESLICE_MS);
      setIsListening(true);
      if (translationQueueRef.current.length > 0) {
        scheduleTranslations();
      }
    } catch (mediaError) {
      console.error("Unable to access microphone", mediaError);
      if (
        mediaError &&
        typeof mediaError === "object" &&
        "name" in mediaError &&
        mediaError.name === "NotAllowedError"
      ) {
        setError("เบราว์เซอร์ไม่อนุญาตให้เข้าถึงไมโครโฟน");
      } else if (
        mediaError &&
        typeof mediaError === "object" &&
        "name" in mediaError &&
        mediaError.name === "NotFoundError"
      ) {
        setError("ไม่พบไมโครโฟนสำหรับใช้งาน");
      } else {
        setError("เปิดไมโครโฟนไม่ได้ กรุณาลองใหม่");
      }
      setIsListening(false);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // ignore stop errors
          }
        });
        mediaStreamRef.current = null;
      }
    }
  }, [isSupported, queueAudioChunkUpload, resetLivePreview, scheduleTranslations]);

  useEffect(() => {
    return () => {
      stopRecorderTracks();
      stopLiveInterval();
      if (interimDebounceRef.current) {
        clearTimeout(interimDebounceRef.current);
        interimDebounceRef.current = null;
      }
    };
  }, [stopLiveInterval, stopRecorderTracks]);

  if (!isSupported) {
    return (
      <div className="rounded-3xl border border-white/10 bg-rose-500/10 px-6 py-6 text-sm text-rose-200">
        เบราว์เซอร์นี้ไม่รองรับการอัดเสียงผ่านไมโครโฟน กรุณาลองใช้ Chrome หรือ Edge เวอร์ชันล่าสุด
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-6 shadow-lg shadow-black/30 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Live translator</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">พูดแล้วแปลทันที</h2>
            <p className="mt-1 text-sm text-slate-300">
              ระบบจะจับเสียงจากไมโครโฟน แปลงเป็นข้อความ แล้วแปลเป็นภาษาที่ตั้งไว้ใน Settings อัตโนมัติ
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 shadow-inner shadow-black/20">
            <span className="uppercase tracking-[0.3em] text-slate-500">Font</span>
            <input
              type="range"
              min={18}
              max={54}
              value={fontSize}
              onChange={(event) => setFontSize(Number(event.target.value))}
              className="w-32 accent-indigo-400"
            />
            <span className="tabular-nums">{fontSize}px</span>
            <button
              type="button"
              onClick={() => setShowOriginal((value) => !value)}
              className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:border-white/40 hover:bg-white/20"
            >
              {showOriginal ? "ซ่อนต้นฉบับ" : "แสดงต้นฉบับ"}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <span>ภาษาที่พูด</span>
            <select
              value={inputLanguage}
              onChange={(event) => setInputLanguage(event.target.value)}
              className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
            >
              {INPUT_LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="text-slate-900">
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className="uppercase tracking-[0.3em] text-slate-500">Target</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-semibold text-white">
              {targetLanguage.toUpperCase()}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={openExternalViewer}
              disabled={!isExternalViewerSupported || !isBroadcastReady}
              title={
                !isExternalViewerSupported
                  ? "เบราว์เซอร์นี้ไม่รองรับ BroadcastChannel จึงเปิดหน้าต่างแยกไม่ได้"
                  : !isBroadcastReady
                    ? "กำลังเตรียมข้อมูลสำหรับหน้าต่างใหม่ โปรดลองอีกครั้ง"
                    : "เปิดหน้าต่างอิสระสำหรับโชว์คำแปล"
              }
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-sky-500/20 px-4 py-2 text-xs font-semibold text-sky-100 transition hover:border-white/40 hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-400"
            >
              🪟 เปิดหน้าต่างอิสระ
            </button>
            {isListening ? (
              <button
                type="button"
                onClick={stopListening}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-rose-500/20 px-5 py-2 text-sm font-semibold text-rose-100 transition hover:border-white/40 hover:bg-rose-500/30"
              >
                ▢ Stop listening
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  void startListening();
                }}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-emerald-500/20 px-5 py-2 text-sm font-semibold text-emerald-100 transition hover:border-white/40 hover:bg-emerald-500/30"
              >
                ● Start listening
              </button>
            )}
            {error ? <span className="text-xs text-rose-200">{error}</span> : null}
          </div>
        </div>
      </div>

      <div className={`flex flex-col gap-6 ${showOriginal ? "lg:flex-row" : "items-stretch"}`}>
        {showOriginal ? (
          <div
            className="flex-1 min-w-[320px]"
            style={{
              resize: "both",
              overflow: "auto",
              minWidth: "320px",
              minHeight: "360px",
              maxWidth: "100%",
            }}
          >
            <section className="flex h-full w-full flex-col space-y-4 rounded-3xl border border-white/10 bg-slate-950/40 px-6 py-6 shadow-inner shadow-black/30">
              <header className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">ต้นฉบับ</h3>
                <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Speaker</span>
              </header>
              <div className="min-h-[200px] rounded-2xl border border-white/10 bg-slate-950/60 px-5 py-4 shadow-inner shadow-black/20">
                {liveOriginal ? (
                  <p
                    className="font-semibold text-white"
                    style={{ fontSize: `${fontSize}px`, lineHeight: 1.35 }}
                  >
                    {liveOriginal}
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">เริ่มพูดเพื่อให้ระบบถอดเสียง</p>
                )}
                {isTranslatingLive ? (
                  <p className="mt-3 text-xs text-slate-400">กำลังถอดเสียง...</p>
                ) : null}
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                  ประวัติ (ต้นฉบับ)
                </p>
                {originalHistory.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    ยังไม่มีข้อมูล เริ่มพูดเพื่อให้ระบบบันทึกได้เลย
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {originalHistory.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200"
                      >
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{item.timestamp}</span>
                          <span className="flex items-center gap-2">
                            <span>{item.sourceLanguage.toUpperCase()}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                                item.status === "interim"
                                  ? "bg-slate-700 text-slate-200"
                                  : "bg-emerald-500/20 text-emerald-200"
                              }`}
                            >
                              {item.status}
                            </span>
                          </span>
                        </div>
                        <p
                          className="mt-2 font-semibold text-white"
                          style={{ fontSize: `${Math.max(fontSize - 6, 16)}px`, lineHeight: 1.35 }}
                        >
                          {item.original}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        ) : null}

        {!isFloatingWindow ? (
          <div
            className={`flex-1 min-w-[320px] ${showOriginal ? "" : "mx-auto w-full"}`}
            style={{
              resize: "both",
              overflow: "auto",
              minWidth: "320px",
              minHeight: "360px",
              maxWidth: "100%",
            }}
          >
            {renderTranslationPanel(false)}
          </div>
        ) : null}
      </div>
      {isFloatingWindow ? (
        <div
          ref={floatingRef}
          className="fixed z-50 w-full max-w-xl drop-shadow-2xl"
          style={{ top: floatingPosition.y, left: floatingPosition.x }}
        >
          {renderTranslationPanel(true)}
        </div>
      ) : null}
    </div>
  );
}
