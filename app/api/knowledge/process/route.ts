import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabaseClient } from "@/lib/supabaseServer";
import {
  chunkText,
  extractTextFromSource,
  type KnowledgeSourceRecord,
} from "@/lib/knowledgeIngest";

const INGESTION_KEY = process.env.KNOWLEDGE_INGESTION_KEY;

export const runtime = "nodejs";

async function listPendingSources(limit: number) {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from("knowledge_sources")
    .select("id,type,source,submitted_by,title,status")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data as KnowledgeSourceRecord[];
}

async function updateStatus(
  id: string,
  status: "processing" | "ready" | "error",
  errorMessage?: string | null
) {
  const supabase = getServiceSupabaseClient();
  const updates: Record<string, string | null> = {
    status,
    error_message: errorMessage ?? null,
  };
  const { error } = await supabase.from("knowledge_sources").update(updates).eq("id", id);
  if (error) {
    console.error("Failed to update knowledge source status", error);
  }
}

async function replaceChunks(sourceId: string, chunks: string[]) {
  const supabase = getServiceSupabaseClient();
  await supabase.from("knowledge_chunks").delete().eq("source_id", sourceId);

  const payload = chunks.map((content, index) => ({
    source_id: sourceId,
    chunk_index: index,
    content,
  }));

  const { error } = await supabase.from("knowledge_chunks").insert(payload);
  if (error) {
    throw error;
  }
}

async function processSource(record: KnowledgeSourceRecord) {
  const supabase = getServiceSupabaseClient();
  await updateStatus(record.id, "processing");

  try {
    const text = await extractTextFromSource(record, supabase);
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      throw new Error("No text chunks were generated from this source.");
    }

    await replaceChunks(record.id, chunks);
    await updateStatus(record.id, "ready");

    return {
      id: record.id,
      status: "ready",
      chunks: chunks.length,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 500) : "Unknown ingestion error";
    await updateStatus(record.id, "error", message);
    return {
      id: record.id,
      status: "error",
      error: message,
    };
  }
}

function authorize(request: NextRequest) {
  if (!INGESTION_KEY) {
    console.warn("KNOWLEDGE_INGESTION_KEY is not configured.");
    return false;
  }
  const header = request.headers.get("authorization");
  return header === `Bearer ${INGESTION_KEY}`;
}

export async function POST(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitParam = Number.parseInt(
    request.nextUrl.searchParams.get("limit") ?? "3",
    10
  );
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 10) : 3;

  try {
    const pending = await listPendingSources(limit);
    if (pending.length === 0) {
      return NextResponse.json({ processed: 0, results: [] });
    }

    const results = [];
    for (const record of pending) {
      const result = await processSource(record);
      results.push(result);
    }

    return NextResponse.json({
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error("Knowledge ingestion failed", error);
    return NextResponse.json({ error: "Ingestion failed" }, { status: 500 });
  }
}
