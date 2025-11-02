'use client';

import { useCallback, useEffect, useRef, useState } from "react";

type ViewerPendingChunk = {
  id: string;
  text: string;
  createdAt: number;
  status: "final" | "partial";
};

type ViewerTranscript = {
  id: string;
  original: string;
  translated: string;
  sourceLanguage: string;
  timestamp: string;
  createdAt: number;
  status: "interim" | "partial" | "final";
};

type ViewerSnapshot = {
  liveTranslation: string;
  isTranslating: boolean;
  transcripts: ViewerTranscript[];
  pendingQueue: ViewerPendingChunk[];
  updatedAt: number;
};

type HistorySegment = {
  id: string;
  text: string;
  createdAt: number;
};

const SPEED_OPTIONS = [
  { value: "slow", label: "ช้า (60 คำ/นาที)", interval: 2500 },
  { value: "medium", label: "ปานกลาง (90 คำ/นาที)", interval: 1500 },
  { value: "fast", label: "เร็ว (120 คำ/นาที)", interval: 900 },
  { value: "instant", label: "ทันที", interval: 0 },
] as const;

export default function VoiceTranslationViewer() {
  const broadcastSupportedInitial =
    typeof window === "undefined" ? true : typeof BroadcastChannel !== "undefined";
  const [isBroadcastSupported] = useState(broadcastSupportedInitial);
  const [snapshot, setSnapshot] = useState<ViewerSnapshot | null>(null);
  const [error, setError] = useState<string | null>(
    broadcastSupportedInitial
      ? null
      : "เบราว์เซอร์นี้ไม่รองรับ BroadcastChannel โหมดหน้าต่างอิสระจึงใช้งานไม่ได้"
  );
  const [connectionState, setConnectionState] = useState<"idle" | "waiting" | "receiving">(
    broadcastSupportedInitial ? "waiting" : "idle"
  );
  const channelRef = useRef<BroadcastChannel | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<ViewerTranscript[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [currentLine, setCurrentLine] = useState<string>("");
  const [history, setHistory] = useState<HistorySegment[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [queuePreview, setQueuePreview] = useState<HistorySegment[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState<typeof SPEED_OPTIONS[number]>(SPEED_OPTIONS[1]);

  const syncQueueMeta = useCallback(() => {
    setPendingCount(queueRef.current.length);
    setQueuePreview(
      queueRef.current.slice(0, 5).map((item) => ({
        id: item.id,
        text: item.translated,
        createdAt: item.createdAt,
      }))
    );
  }, []);

  const clearIntervalRef = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const flushNextSegment = useCallback(() => {
    const nextItem = queueRef.current.shift();
    if (!nextItem) {
      setPendingCount(queueRef.current.length);
      return false;
    }

    setCurrentLine(nextItem.translated);
    setHistory((prev) => {
      const nextHistory = [
        ...prev,
        { id: nextItem.id, text: nextItem.translated, createdAt: nextItem.createdAt },
      ];
      return nextHistory.slice(-200);
    });
    syncQueueMeta();
    return true;
  }, [syncQueueMeta]);

  const startTicker = useCallback(() => {
    clearIntervalRef();
    if (speed.interval === 0) {
      // Instant mode: flush immediately while data is available
      while (!isPaused && queueRef.current.length > 0) {
        const processed = flushNextSegment();
        if (!processed) break;
      }
      return;
    }

    intervalRef.current = window.setInterval(() => {
      if (isPaused) {
        return;
      }
      if (queueRef.current.length === 0) {
        return;
      }
      flushNextSegment();
    }, speed.interval);
  }, [clearIntervalRef, flushNextSegment, isPaused, speed.interval]);

  useEffect(() => {
    if (!isBroadcastSupported || typeof window === "undefined") return;

    const channel = new BroadcastChannel("voice-translator");
    channelRef.current = channel;

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data?.type === "state" && data.payload) {
        setSnapshot(data.payload as ViewerSnapshot);
        setConnectionState("receiving");
        setError(null);
      }
    };

    channel.addEventListener("message", handleMessage);
    channel.postMessage({ type: "request_latest" });

    const intervalId = window.setInterval(() => {
      channel.postMessage({ type: "request_latest" });
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
      channel.removeEventListener("message", handleMessage);
      channel.close();
      channelRef.current = null;
    };
  }, [isBroadcastSupported]);

  useEffect(() => {
    if (!snapshot) return;

    const finals = [...snapshot.transcripts]
      .filter((item) => item.status === "final")
      .sort((a, b) => a.createdAt - b.createdAt);

    let appended = false;
    for (const item of finals) {
      if (seenIdsRef.current.has(item.id)) {
        continue;
      }
      seenIdsRef.current.add(item.id);
      queueRef.current.push(item);
      appended = true;
    }

    if (appended) {
      queueRef.current.sort((a, b) => a.createdAt - b.createdAt);
      syncQueueMeta();
      if (!currentLine) {
        flushNextSegment();
      }
    }
  }, [flushNextSegment, snapshot, currentLine, syncQueueMeta]);

  useEffect(() => {
    startTicker();
    return () => {
      clearIntervalRef();
    };
  }, [clearIntervalRef, startTicker]);

  const handleSpeedChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as typeof SPEED_OPTIONS[number]["value"];
    const next = SPEED_OPTIONS.find((option) => option.value === value) ?? SPEED_OPTIONS[1];
    setSpeed(next);
  }, []);

  const handleTogglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  return (
    <div className="flex min-h-screen w-full justify-center bg-[radial-gradient(circle_at_top,_#0f172a,_#020617_55%)] px-4 py-6 text-slate-100">
      <div className="flex w-full max-w-3xl flex-col gap-6 rounded-[32px] border border-white/10 bg-slate-950/70 px-6 py-6 shadow-[0_30px_70px_-35px_rgba(15,23,42,0.95)] backdrop-blur-xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-slate-500">Live translation viewer</p>
            <h1 className="text-2xl font-semibold text-white">หน้าต่างแสดงคำแปล</h1>
            <p className="mt-1 text-sm text-slate-300">
              หน้านี้จะแสดงผลจากแท็บหลักแบบเรียลไทม์ โปรดเปิดหน้าหลักทิ้งไว้และอนุญาตป๊อปอัปเพื่อใช้ไมโครโฟน
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold text-slate-200 shadow-inner shadow-black/20">
            สถานะ:{" "}
            <span
              className={
                connectionState === "receiving"
                  ? "text-emerald-300"
                  : connectionState === "waiting"
                    ? "text-amber-300"
                    : "text-slate-300"
              }
            >
              {connectionState === "receiving"
                ? "รับข้อมูลอยู่"
                : connectionState === "waiting"
                  ? "รอสัญญาณจากแท็บหลัก..."
                  : "ยังไม่ได้เชื่อมต่อ"}
            </span>
            {snapshot ? (
              <span className="ml-2 text-[10px] font-normal text-slate-400">
                อัปเดตล่าสุด {new Date(snapshot.updatedAt).toLocaleTimeString()}
              </span>
            ) : null}
          </div>
        </header>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-200 shadow-inner shadow-black/20">
          <label className="flex items-center gap-2">
            <span className="uppercase tracking-[0.25em] text-slate-500">จังหวะ</span>
            <select
              value={speed.value}
              onChange={handleSpeedChange}
              className="rounded-xl border border-white/15 bg-slate-900/80 px-3 py-1 text-xs font-semibold text-white focus:border-white/40 focus:outline-none"
            >
              {SPEED_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="text-slate-900">
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTogglePause}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                isPaused
                  ? "border border-emerald-400/40 bg-emerald-500/20 text-emerald-100 hover:border-emerald-300/60 hover:bg-emerald-500/30"
                  : "border border-white/20 bg-white/10 text-slate-200 hover:border-white/40 hover:bg-white/15"
              }`}
            >
              {isPaused ? "▶ ต่อ" : "⏸ หยุดชั่วคราว"}
            </button>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
              คิว {pendingCount} บรรทัด
            </span>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-950/60 px-5 py-5 shadow-inner shadow-black/30">
          <header className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">ผลแบบเรียลไทม์</h2>
            {snapshot?.isTranslating ? (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-100">
                กำลังถอดเสียง/แปล...
              </span>
            ) : null}
          </header>
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-200">คำแปลสด</p>
            <p className="mt-3 min-h-[160px] whitespace-pre-wrap text-xl font-semibold leading-relaxed text-emerald-100">
              {currentLine ||
                snapshot?.liveTranslation ||
                "รอสัญญาณคำแปลจากแท็บหลัก..."}
            </p>
          </div>
          {queuePreview.length > 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">กำลังจะถึง</p>
              <ul className="mt-2 space-y-1 text-slate-200/90">
                {queuePreview.map((item) => (
                  <li key={item.id} className="truncate">
                    {new Date(item.createdAt).toLocaleTimeString()} · {item.text}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-slate-950/60 px-5 py-5 shadow-inner shadow-black/30">
          <header className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">ประวัติคำแปล</h2>
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">
              ทั้งหมด {history.length} รายการ
            </span>
          </header>
          <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
            {history.length === 0 ? (
              <p className="text-sm text-slate-400">
                ยังไม่พบคำแปลสุดท้ายจากแท็บหลัก โปรดลองเริ่มการพูดในหน้าหลักก่อน
              </p>
            ) : (
              history.map((item) => (
                <article
                  key={item.id}
                  className="space-y-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
                >
                  <header className="flex flex-wrap items-center justify-between text-xs text-emerald-200/80">
                    <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                    <span className="uppercase text-emerald-200/70">FINAL</span>
                  </header>
                  <p className="whitespace-pre-wrap text-[13px] font-semibold text-emerald-100">
                    {item.text}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>

        {snapshot?.pendingQueue?.length ? (
          <section className="rounded-3xl border border-amber-400/25 bg-amber-500/10 px-5 py-4 text-xs text-amber-100">
            <p className="uppercase tracking-[0.3em] text-amber-200/80">คิวคำแปลที่รอประมวลผล</p>
            <ul className="mt-2 space-y-1">
              {snapshot.pendingQueue.map((item) => (
                <li key={item.id} className="truncate">
                  {new Date(item.createdAt).toLocaleTimeString()} · {item.text}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
