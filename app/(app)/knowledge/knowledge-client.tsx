"use client";

import { useMemo, useState } from "react";

type KnowledgeType = "url" | "pdf" | "youtube";
type KnowledgeTab = KnowledgeType | "text";

export type KnowledgeEntry = {
  id: string;
  type: KnowledgeType | "text";
  title: string | null;
  source: string;
  status: string;
  error_message: string | null;
  created_at: string;
};

type StatusMessage = {
  type: "success" | "error";
  text: string;
} | null;

const tabs: { value: KnowledgeTab; label: string; description: string }[] = [
  { value: "url", label: "Add URL", description: "เพิ่มหน้าเว็บหรือบทความที่ต้องการให้ Agent จำ" },
  { value: "pdf", label: "Add PDF", description: "อัปโหลดไฟล์ PDF (เอกสาร, คู่มือ, pitch deck)" },
  { value: "youtube", label: "Add YouTube", description: "ใส่ลิงก์หรือ Video ID เพื่อแปลงเป็นความรู้" },
  { value: "text", label: "Add Text", description: "คัดลอกข้อความสำคัญวางตรงนี้ ระบบจะแปลงเป็นความรู้ทันที" },
];

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function KnowledgeClient({ initialEntries }: { initialEntries: KnowledgeEntry[] }) {
  const [activeTab, setActiveTab] = useState<KnowledgeTab>("url");
  const [urlTitle, setUrlTitle] = useState("");
  const [urlValue, setUrlValue] = useState("");
  const [ytTitle, setYtTitle] = useState("");
  const [ytValue, setYtValue] = useState("");
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [statusMessage, setStatusMessage] = useState<StatusMessage>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [entries, setEntries] = useState<KnowledgeEntry[]>(initialEntries);

  const latestEntries = useMemo(() => entries.slice(0, 10), [entries]);

  async function postJson(payload: {
    type: KnowledgeTab;
    title?: string;
    source?: string;
    content?: string;
  }) {
    const response = await fetch("/api/knowledge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Request failed");
    }

    const { data } = (await response.json()) as { data: KnowledgeEntry };
    return data;
  }

  async function postPdf() {
    if (!pdfFile) {
      throw new Error("กรุณาเลือกไฟล์ PDF");
    }
    const formData = new FormData();
    formData.append("type", "pdf");
    formData.append("title", pdfTitle || pdfFile.name);
    formData.append("file", pdfFile);

    const response = await fetch("/api/knowledge", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Request failed");
    }

    const { data } = (await response.json()) as { data: KnowledgeEntry };
    return data;
  }

  function prependEntry(entry: KnowledgeEntry) {
    setEntries((prev) => [entry, ...prev].slice(0, 20));
  }

  async function handleSubmitUrl() {
    if (!urlValue.trim()) {
      setStatusMessage({ type: "error", text: "กรุณากรอก URL ก่อนนะคะ" });
      return;
    }
    try {
      setSubmitting(true);
      setStatusMessage(null);
      const entry = await postJson({
        type: "url",
        title: urlTitle || urlValue,
        source: urlValue,
      });
      prependEntry(entry);
      setUrlTitle("");
      setUrlValue("");
      setStatusMessage({ type: "success", text: "เพิ่ม URL เข้าระบบเรียบร้อยแล้วค่ะ" });
    } catch (error) {
      console.error(error);
      setStatusMessage({ type: "error", text: "เพิ่ม URL ไม่สำเร็จ ลองใหม่อีกครั้งนะคะ" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitYoutube() {
    if (!ytValue.trim()) {
      setStatusMessage({ type: "error", text: "กรุณากรอกลิงก์หรือ Video ID ก่อนนะคะ" });
      return;
    }
    try {
      setSubmitting(true);
      setStatusMessage(null);
      const entry = await postJson({
        type: "youtube",
        title: ytTitle || ytValue,
        source: ytValue,
      });
      prependEntry(entry);
      setYtTitle("");
      setYtValue("");
      setStatusMessage({ type: "success", text: "เพิ่ม YouTube เรียบร้อยแล้วค่ะ" });
    } catch (error) {
      console.error(error);
      setStatusMessage({ type: "error", text: "เพิ่ม YouTube ไม่สำเร็จ ลองใหม่อีกครั้งนะคะ" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitPdf() {
    if (!pdfFile) {
      setStatusMessage({ type: "error", text: "กรุณาเลือกไฟล์ PDF ก่อนนะคะ" });
      return;
    }
    try {
      setSubmitting(true);
      setStatusMessage(null);
      const entry = await postPdf();
      prependEntry(entry);
      setPdfTitle("");
      setPdfFile(null);
      setStatusMessage({ type: "success", text: "อัปโหลด PDF เรียบร้อยแล้วค่ะ" });
    } catch (error) {
      console.error(error);
      setStatusMessage({ type: "error", text: "อัปโหลด PDF ไม่สำเร็จ ลองใหม่อีกครั้งนะคะ" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitText() {
    if (!textContent.trim()) {
      setStatusMessage({ type: "error", text: "กรุณาวางข้อความก่อนนะคะ" });
      return;
    }
    try {
      setSubmitting(true);
      setStatusMessage(null);
      const entry = await postJson({
        type: "text",
        title: textTitle || "Manual entry",
        content: textContent,
      });
      prependEntry(entry);
      setTextTitle("");
      setTextContent("");
      setStatusMessage({ type: "success", text: "บันทึกข้อความเรียบร้อยแล้วค่ะ" });
    } catch (error) {
      console.error(error);
      setStatusMessage({ type: "error", text: "บันทึกข้อความไม่สำเร็จ ลองใหม่อีกครั้งนะคะ" });
    } finally {
      setSubmitting(false);
    }
  }

  async function triggerIngestion() {
    try {
      setIngesting(true);
      setStatusMessage(null);
      const response = await fetch("/api/run-ingest", {
        method: "POST",
      });

      const payload = await response.json();

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error ?? "Ingestion failed");
      }

      setStatusMessage({
        type: "success",
        text: "เริ่มประมวลผลแหล่งความรู้ตามคิวแล้วค่ะ",
      });
    } catch (error) {
      console.error(error);
      setStatusMessage({
        type: "error",
        text: "เรียกใช้งานตัวประมวลผลไม่สำเร็จ ลองใหม่อีกครั้งนะคะ",
      });
    } finally {
      setIngesting(false);
    }
  }

  function renderTabContent() {
    switch (activeTab) {
      case "url":
        return (
          <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4">
            <input
              className="w-full rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-white focus:outline-none"
              placeholder="ชื่อ/คำอธิบาย (ไม่กรอกก็ได้)"
              value={urlTitle}
              onChange={(event) => setUrlTitle(event.target.value)}
            />
            <input
              className="w-full rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-white focus:outline-none"
              placeholder="https://example.com/article"
              value={urlValue}
              onChange={(event) => setUrlValue(event.target.value)}
            />
            <button
              className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-70"
              onClick={handleSubmitUrl}
              disabled={submitting}
            >
              บันทึก URL
            </button>
          </div>
        );
      case "pdf":
        return (
          <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4">
            <input
              className="w-full rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-white focus:outline-none"
              placeholder="ชื่อเอกสาร (ไม่กรอกก็ได้)"
              value={pdfTitle}
              onChange={(event) => setPdfTitle(event.target.value)}
            />
            <input
              type="file"
              accept="application/pdf"
              className="w-full rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-900"
              onChange={(event) => setPdfFile(event.target.files?.[0] ?? null)}
            />
            <button
              className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-70"
              onClick={handleSubmitPdf}
              disabled={submitting}
            >
              อัปโหลด PDF
            </button>
          </div>
        );
      case "youtube":
        return (
          <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4">
            <input
              className="w-full rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-white focus:outline-none"
              placeholder="ชื่อ/คำอธิบาย (ไม่กรอกก็ได้)"
              value={ytTitle}
              onChange={(event) => setYtTitle(event.target.value)}
            />
            <input
              className="w-full rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-white focus:outline-none"
              placeholder="https://youtube.com/watch?v=..."
              value={ytValue}
              onChange={(event) => setYtValue(event.target.value)}
            />
            <button
              className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-70"
              onClick={handleSubmitYoutube}
              disabled={submitting}
            >
              บันทึก YouTube
            </button>
          </div>
        );
      case "text":
        return (
          <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4">
            <input
              className="w-full rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-white focus:outline-none"
              placeholder="ชื่อ / โน้ต (ไม่กรอกก็ได้)"
              value={textTitle}
              onChange={(event) => setTextTitle(event.target.value)}
            />
            <textarea
              className="min-h-[160px] w-full rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-white focus:outline-none"
              placeholder="คัดลอกข้อความยาว ๆ วางตรงนี้"
              value={textContent}
              onChange={(event) => setTextContent(event.target.value)}
            />
            <button
              className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-70"
              onClick={handleSubmitText}
              disabled={submitting}
            >
              บันทึกข้อความ
            </button>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="flex min-h-screen justify-center bg-[radial-gradient(circle_at_top,_#14182c,_#05070f_55%)] px-6 py-12 text-slate-50">
      <div className="w-full max-w-5xl space-y-8 rounded-[32px] border border-white/10 bg-white/5 px-8 py-10 shadow-[0_40px_80px_-30px_rgba(15,23,42,0.9)] backdrop-blur-xl">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Knowledge center</p>
          <h1 className="text-3xl font-semibold text-white">จัดการแหล่งความรู้</h1>
          <p className="text-sm text-slate-300">
            เพิ่ม URL, PDF และ YouTube ในหน้าเดียว ระบบจะนำไปประมวลผลเพื่อสอน Agent ให้ตอบตรงกับข้อมูลบริษัทเท่านั้น
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <a
              href="/knowledge/logs"
              className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/40 hover:bg-white/20"
            >
              ดูรายการทั้งหมด
            </a>
            <button
              onClick={triggerIngestion}
              disabled={ingesting}
              className="inline-flex items-center rounded-full border border-emerald-300/40 bg-emerald-400/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100 transition hover:border-emerald-300/70 hover:bg-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {ingesting ? "กำลังประมวลผล..." : "ประมวลผลทันที"}
            </button>
          </div>
        </header>

        <section className="space-y-4">
          <div className="flex flex-wrap gap-2 rounded-3xl border border-white/10 bg-black/30 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  activeTab === tab.value
                    ? "bg-white text-slate-900"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <p className="text-sm text-slate-300">
            {tabs.find((tab) => tab.value === activeTab)?.description}
          </p>
          {statusMessage && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                statusMessage.type === "success"
                  ? "border-emerald-400/60 text-emerald-200"
                  : "border-rose-400/60 text-rose-200"
              }`}
            >
              {statusMessage.text}
            </div>
          )}
          {renderTabContent()}
        </section>

        <section className="rounded-3xl border border-white/10 bg-black/30 px-6 py-6 shadow-inner shadow-black/40">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Recent submissions</p>
              <h2 className="mt-2 text-xl font-semibold text-white">รายการล่าสุด</h2>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-200">
              <thead className="text-xs uppercase tracking-[0.2em] text-slate-400">
                <tr>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Title</th>
                  <th className="px-2 py-2">Source</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {latestEntries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-2 py-6 text-center text-slate-400">
                      ยังไม่มีแหล่งความรู้ที่บันทึกไว้ ลองเพิ่มจากแบบฟอร์มด้านบนได้เลยค่ะ
                    </td>
                  </tr>
                )}
                {latestEntries.map((entry) => (
                  <tr key={entry.id} className="border-t border-white/10">
                    <td className="px-2 py-3 font-semibold uppercase tracking-widest text-slate-400">
                      {entry.type}
                    </td>
                    <td className="px-2 py-3 text-white">{entry.title || "—"}</td>
                    <td className="px-2 py-3 text-slate-300">
                      <span className="break-all text-xs">{entry.source}</span>
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          entry.status === "ready"
                            ? "bg-emerald-400/15 text-emerald-200"
                            : entry.status === "error"
                              ? "bg-rose-400/15 text-rose-200"
                              : "bg-amber-400/15 text-amber-200"
                        }`}
                      >
                        {entry.status}
                      </span>
                      {entry.error_message && (
                        <p className="mt-1 text-xs text-rose-200">{entry.error_message}</p>
                      )}
                    </td>
                    <td className="px-2 py-3 text-slate-400">{formatTimestamp(entry.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
