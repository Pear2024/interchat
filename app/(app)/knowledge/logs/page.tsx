import { redirect } from "next/navigation";
import { ensureProfile } from "@/app/actions/ensure-profile";
import { getServerSupabaseClient, getServiceSupabaseClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type KnowledgeRow = {
  id: string;
  type: string;
  title: string | null;
  source: string;
  status: string;
  error_message: string | null;
  created_at: string;
  tags: string[] | null;
};

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

export default async function KnowledgeLogsPage() {
  const supabase = await getServerSupabaseClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    redirect("/login");
  }

  await ensureProfile();

  const serviceClient = getServiceSupabaseClient();
  const { data: sources, error } = await serviceClient
    .from("knowledge_sources")
    .select("id,type,title,source,status,error_message,created_at,tags")
    .eq("submitted_by", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Failed to fetch knowledge logs", error);
  }

  const rows = (sources ?? []) as KnowledgeRow[];
  const sourceIds = rows.map((row) => row.id);

  let chunkCountMap = new Map<string, number>();

  if (sourceIds.length > 0) {
    const { data: chunkRows, error: chunkError } = await serviceClient
      .from("knowledge_chunks")
      .select("source_id")
      .in("source_id", sourceIds);

    if (chunkError) {
      console.warn("Failed to fetch knowledge chunk counts", chunkError);
    } else if (chunkRows) {
      chunkCountMap = chunkRows.reduce((map, row: { source_id: string }) => {
        map.set(row.source_id, (map.get(row.source_id) ?? 0) + 1);
        return map;
      }, new Map<string, number>());
    }
  }

  return (
    <div className="flex min-h-screen justify-center bg-[radial-gradient(circle_at_top,_#14182c,_#05070f_55%)] px-6 py-12 text-slate-50">
      <div className="w-full max-w-6xl space-y-8 rounded-[32px] border border-white/10 bg-white/5 px-8 py-10 shadow-[0_40px_80px_-30px_rgba(15,23,42,0.9)] backdrop-blur-xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Knowledge center</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">ประวัติแหล่งความรู้</h1>
            <p className="mt-2 text-sm text-slate-300">
              ตรวจสอบว่ามีข้อมูลอะไรบ้างที่ถูกบันทึกและประมวลผลในคลัง เพื่อให้แน่ใจว่า Agent ใช้ข้อมูลล่าสุดเสมอ
            </p>
          </div>
          <a
            href="/knowledge"
            className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/20"
          >
            ← กลับไปหน้าเพิ่มข้อมูล
          </a>
        </header>

        <section className="overflow-x-auto rounded-3xl border border-white/10 bg-black/30 px-6 py-6 shadow-inner shadow-black/40">
          <table className="w-full text-left text-sm text-slate-200">
            <thead className="text-xs uppercase tracking-[0.2em] text-slate-400">
              <tr>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Title</th>
                <th className="px-2 py-2">Source</th>
                <th className="px-2 py-2">Tags</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Chunks</th>
                <th className="px-2 py-2">Created</th>
                <th className="px-2 py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-center text-slate-400">
                    ยังไม่มีแหล่งความรู้ในระบบ ลองเพิ่มจากหน้า /knowledge ก่อนนะคะ
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-white/10">
                  <td className="px-2 py-3 font-semibold uppercase tracking-widest text-slate-400">
                    {row.type}
                  </td>
                  <td className="px-2 py-3 text-white">{row.title || "—"}</td>
                  <td className="px-2 py-3 text-slate-300">
                    <span className="break-all text-xs">{row.source}</span>
                  </td>
                  <td className="px-2 py-3">
                    {row.tags && row.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {row.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] uppercase tracking-widest text-slate-200"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        row.status === "ready"
                          ? "bg-emerald-400/15 text-emerald-200"
                          : row.status === "error"
                            ? "bg-rose-400/15 text-rose-200"
                            : "bg-amber-400/15 text-amber-200"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-center text-white">
                    {chunkCountMap.get(row.id) ?? 0}
                  </td>
                  <td className="px-2 py-3 text-slate-400">{formatTimestamp(row.created_at)}</td>
                  <td className="px-2 py-3 text-xs text-rose-200">
                    {row.error_message ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
