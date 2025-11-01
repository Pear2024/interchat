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

const INPUT_LANGUAGE_OPTIONS = [
  { value: "th-TH", label: "Thai" },
  { value: "en-US", label: "English" },
  { value: "jp-JP", label: "Japanese" },
  { value: "zh-CN", label: "Chinese" },
];


export default function VoiceTranslator({
  targetLanguage,
}: {
  targetLanguage: string;
}) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputLanguage, setInputLanguage] = useState<string>("th-TH");
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [interimSegments, setInterimSegments] = useState<Transcript[]>([]);
  const [liveOriginal, setLiveOriginal] = useState("");
  const [liveTranslation, setLiveTranslation] = useState("");
  const [isTranslatingLive, setIsTranslatingLive] = useState(false);
  const [fontSize, setFontSize] = useState(28);
  const [showOriginal, setShowOriginal] = useState(true);
  const [showTranslationHistory, setShowTranslationHistory] = useState(true);
  const [displayedNarrative, setDisplayedNarrative] = useState("");
  const [pendingQueue, setPendingQueue] = useState<PendingChunk[]>([]);
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveOriginalRef = useRef<string>("");
  const lastInterimTextRef = useRef<string>("");
  const displayedNarrativeRef = useRef("");
  const isTranslatingLiveRef = useRef(false);
  const narrativeLengthRef = useRef(0);
  const translationQueueRef = useRef<PendingChunk[]>([]);
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

  useEffect(() => {
    displayedNarrativeRef.current = displayedNarrative;
  }, [displayedNarrative]);

  useEffect(() => {
    isTranslatingLiveRef.current = isTranslatingLive;
  }, [isTranslatingLive]);

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

  const stopLiveInterval = useCallback(() => {
    if (liveIntervalRef.current) {
      clearInterval(liveIntervalRef.current);
      liveIntervalRef.current = null;
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

  const processQueue = useCallback(async () => {
    if (isTranslatingLiveRef.current) return;

    const nextItem = translationQueueRef.current.shift();
    if (!nextItem) {
      updateQueueState();
      return;
    }

    updateQueueState();
    isTranslatingLiveRef.current = true;
    setIsTranslatingLive(true);

    try {
      const result = await translateSegment(nextItem.text);
      const translated = result?.translation?.trim() || nextItem.text;
      const entry: Transcript = {
        id: nextItem.id,
        original: nextItem.text,
        translated,
        sourceLanguage: result?.detected ?? "unknown",
        timestamp: new Date(nextItem.createdAt).toLocaleTimeString(),
        createdAt: nextItem.createdAt,
        status: "final",
      };

      setError(null);
      setLiveOriginal(nextItem.text);
      setLiveTranslation(translated);
      setTranscripts((current) => [entry, ...current]);
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        translationQueueRef.current.unshift(nextItem);
        updateQueueState();
        setError(error.message);
        recognitionRef.current?.stop();
        stopLiveInterval();
        setIsListening(false);
        isTranslatingLiveRef.current = false;
        setIsTranslatingLive(false);
        return;
      }

      const entry: Transcript = {
        id: nextItem.id,
        original: nextItem.text,
        translated: "(translation unavailable)",
        sourceLanguage: "unknown",
        timestamp: new Date(nextItem.createdAt).toLocaleTimeString(),
        createdAt: nextItem.createdAt,
        status: "final",
      };
      setLiveOriginal(nextItem.text);
      setLiveTranslation("(translation unavailable)");
      setTranscripts((current) => [entry, ...current]);
      setError(
        error instanceof Error ? error.message : "ไม่สามารถแปลได้"
      );
    } finally {
      isTranslatingLiveRef.current = false;
      setIsTranslatingLive(false);
      updateQueueState();
    }

    if (translationQueueRef.current.length > 0) {
      void processQueue();
    }
  }, [translateSegment, stopLiveInterval, updateQueueState]);

  const enqueueTranslation = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const createdAt = Date.now();
      const item: PendingChunk = {
        id: `${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
        text: trimmed,
        createdAt,
      };

      translationQueueRef.current.push(item);
      updateQueueState();

      if (!isTranslatingLiveRef.current) {
        void processQueue();
      }
    },
    [processQueue, updateQueueState]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as typeof window & { webkitSpeechRecognition?: unknown })
        .SpeechRecognition ||
      (window as typeof window & { webkitSpeechRecognition?: unknown })
        .webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
    }
  }, []);

  const resetLivePreview = useCallback(
    ({ keepDisplay = false }: { keepDisplay?: boolean } = {}) => {
      stopLiveInterval();
      if (!keepDisplay) {
        setLiveOriginal("");
        setLiveTranslation("");
      }
      isTranslatingLiveRef.current = false;
      setIsTranslatingLive(false);
      liveOriginalRef.current = "";
      lastInterimTextRef.current = "";
    },
    [stopLiveInterval]
  );

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    resetLivePreview({ keepDisplay: true });
  }, [resetLivePreview]);

  const handleFinalTranscript = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      setLiveOriginal(trimmed);
      setInterimSegments((current) =>
        current.filter((segment) => segment.original.trim() !== trimmed)
      );
      lastInterimTextRef.current = "";
      enqueueTranslation(trimmed);
    },
    [enqueueTranslation]
  );

  const handleInterimTranscript = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      setLiveOriginal(trimmed);
      liveOriginalRef.current = trimmed;

      if (!trimmed) {
        setInterimSegments([]);
        lastInterimTextRef.current = "";
        return;
      }

      setInterimSegments((current) => {
        const updated = current.filter(
          (segment) => segment.status !== "interim"
        );
        const createdAt = Date.now();
        updated.unshift({
          id: `${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
          original: trimmed,
          translated: "",
          sourceLanguage: "unknown",
          timestamp: new Date(createdAt).toLocaleTimeString(),
          createdAt,
          status: "interim",
        });
        lastInterimTextRef.current = trimmed;
        return updated;
      });
    },
    []
  );

  const startListening = useCallback(() => {
    setError(null);
    resetLivePreview();

    const SpeechRecognition =
      (window as typeof window & { webkitSpeechRecognition?: unknown })
        .SpeechRecognition ||
      (window as typeof window & { webkitSpeechRecognition?: unknown })
        .webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = inputLanguage;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let latestInterim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";

        if (result.isFinal) {
          void handleFinalTranscript(transcript);
        } else {
          latestInterim = transcript;
        }
      }

      if (latestInterim) {
        setError(null);
        handleInterimTranscript(latestInterim);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech") {
        setError("ไม่ได้ยินเสียงพูด ลองใหม่อีกครั้ง");
      } else if (event.error === "not-allowed") {
        setError("เบราว์เซอร์ไม่อนุญาตให้เข้าถึงไมโครโฟน");
      } else {
        setError(`เกิดข้อผิดพลาด: ${event.error}`);
      }
      setIsListening(false);
      resetLivePreview({ keepDisplay: true });
    };

    recognition.onend = () => {
      setIsListening(false);
      resetLivePreview({ keepDisplay: true });
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
    if (!isTranslatingLiveRef.current && translationQueueRef.current.length > 0) {
      void processQueue();
    }
  }, [handleFinalTranscript, handleInterimTranscript, inputLanguage, processQueue, resetLivePreview]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      stopLiveInterval();
    };
  }, [stopLiveInterval]);

  if (!isSupported) {
    return (
      <div className="rounded-3xl border border-white/10 bg-rose-500/10 px-6 py-6 text-sm text-rose-200">
        เบราว์เซอร์นี้ไม่รองรับ Speech Recognition (Web Speech API) กรุณาลองใช้ Chrome หรือ
        Edge เวอร์ชันล่าสุด
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
                onClick={startListening}
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
          <section className="flex h-full w-full flex-col space-y-4 rounded-3xl border border-white/10 bg-slate-950/40 px-6 py-6 shadow-inner shadow-black/30">
            <header className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">คำแปล</h3>
              <span className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Target: {targetLanguage.toUpperCase()}
              </span>
            </header>
            <div className="min-h-[200px] rounded-2xl border border-white/10 bg-slate-950/60 px-5 py-4 shadow-inner shadow-black/20">
              {displayedNarrative ? (
                <p
                  className="font-semibold text-emerald-100 whitespace-pre-wrap"
                  style={{ fontSize: `${fontSize}px`, lineHeight: 1.35 }}
                >
                  {displayedNarrative}
                </p>
              ) : liveTranslation ? (
                <p
                  className="font-semibold text-emerald-100 whitespace-pre-wrap"
                  style={{ fontSize: `${fontSize}px`, lineHeight: 1.35 }}
                >
                  {liveTranslation}
                </p>
              ) : (
                <p className="text-sm text-slate-500">ระบบจะแปลและแสดงผลอัตโนมัติ</p>
              )}
              {isTranslatingLive ? (
                <p className="mt-3 text-xs text-emerald-200">กำลังแปล...</p>
              ) : null}
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
        </div>
      </div>
    </div>
  );
}
