'use client';

import { useEffect, useMemo, useRef, useState } from "react";

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
  liveOriginal: string;
  liveTranslation: string;
  isTranslating: boolean;
  transcripts: ViewerTranscript[];
  pendingQueue: ViewerPendingChunk[];
  updatedAt: number;
};

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

  const latestFinalTranslations = useMemo(() => {
    if (!snapshot) return [];
    return [...snapshot.transcripts]
      .filter((item) => item.status !== "interim")
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [snapshot]);

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
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">ต้นฉบับ</p>
              <p className="mt-2 min-h-[120px] whitespace-pre-wrap text-lg font-semibold text-white">
                {snapshot?.liveOriginal || "รอสัญญาณจากแท็บหลัก..."}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-200">คำแปล</p>
              <p className="mt-2 min-h-[120px] whitespace-pre-wrap text-lg font-semibold text-emerald-100">
                {snapshot?.liveTranslation || "รอสัญญาณจากแท็บหลัก..."}
              </p>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-slate-950/60 px-5 py-5 shadow-inner shadow-black/30">
          <header className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">ประวัติคำแปล</h2>
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">
              ทั้งหมด {latestFinalTranslations.length} รายการ
            </span>
          </header>
          <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
            {latestFinalTranslations.length === 0 ? (
              <p className="text-sm text-slate-400">
                ยังไม่พบคำแปลสุดท้ายจากแท็บหลัก โปรดลองเริ่มการพูดในหน้าหลักก่อน
              </p>
            ) : (
              latestFinalTranslations.map((item) => (
                <article
                  key={item.id}
                  className="space-y-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
                >
                  <header className="flex flex-wrap items-center justify-between text-xs text-emerald-200/80">
                    <span>{item.timestamp}</span>
                    <span className="uppercase">
                      {item.sourceLanguage.toUpperCase()} → {item.status.toUpperCase()}
                    </span>
                  </header>
                  <p className="whitespace-pre-wrap text-[13px] font-semibold text-white">
                    {item.original}
                  </p>
                  <p className="whitespace-pre-wrap text-[13px] font-semibold text-emerald-100">
                    {item.translated}
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
