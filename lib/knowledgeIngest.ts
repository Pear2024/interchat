import { htmlToText } from "html-to-text";
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_CHUNK_WORDS = 1000;
const MAX_CHUNKS = 30;
const DEFAULT_BUCKET = process.env.KNOWLEDGE_STORAGE_BUCKET?.trim() || "knowledge-sources";

export type KnowledgeSourceRecord = {
  id: string;
  type: "url" | "pdf" | "youtube" | "text";
  source: string;
  submitted_by: string;
  title?: string | null;
  raw_text?: string | null;
};

function normalizeUrl(raw: string) {
  if (!raw) return raw;
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  return `https://${raw}`;
}

function resolveGoogleDocExport(url: string) {
  const docMatch = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/i);
  if (docMatch) {
    const docId = docMatch[1];
    return `https://docs.google.com/document/d/${docId}/export?format=txt`;
  }
  return null;
}

async function fetchReadableFromProxy(url: string) {
  try {
    const proxied = `https://r.jina.ai/${url}`;
    const response = await fetch(proxied, {
      headers: {
        "User-Agent": "Mozilla/5.0 (IngestBot/1.0)",
      },
    });
    if (response.ok) {
      const text = await response.text();
      if (text.trim().length > 200) {
        return text;
      }
    }
  } catch (error) {
    console.warn("Readable proxy fetch failed", error);
  }
  return null;
}

async function fetchUrlContent(url: string) {
  const normalized = normalizeUrl(url);
  const googleDocExport = resolveGoogleDocExport(normalized);

  if (googleDocExport) {
    const response = await fetch(googleDocExport, {
      headers: {
        "User-Agent": "Mozilla/5.0 (IngestBot/1.0)",
        Accept: "text/plain",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Google Doc export: ${response.status}`);
    }

    return await response.text();
  }

  const proxiedText = await fetchReadableFromProxy(normalized);
  if (proxiedText) {
    return proxiedText;
  }

  const response = await fetch(normalized, {
    headers: {
      "User-Agent": "Mozilla/5.0 (IngestBot/1.0)",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status}`);
  }

  const html = await response.text();
  return htmlToText(html, {
    selectors: [{ selector: "script", format: "skip" }],
    wordwrap: false,
  });
}

let pdfParser: ((data: Buffer) => Promise<{ text: string }>) | null = null;

async function ensurePdfParser() {
  if (!pdfParser) {
    const imported = await import("pdf-parse");
    const parser = (imported as { default?: (data: Buffer) => Promise<{ text: string }> }).default;
    if (!parser) {
      throw new Error("Unable to load pdf-parse module");
    }
    pdfParser = parser;
  }
  return pdfParser;
}

async function fetchPdfContent(source: string, supabase: SupabaseClient) {
  const [bucket, ...pathSegments] = source.includes(":")
    ? source.split(":")
    : [DEFAULT_BUCKET, source];
  const storagePath = pathSegments.join(":");

  if (!bucket || !storagePath) {
    throw new Error("Invalid PDF storage path");
  }

  const { data, error } = await supabase.storage.from(bucket).download(storagePath);

  if (error || !data) {
    throw new Error("Unable to download PDF from storage");
  }

  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const parse = await ensurePdfParser();
  const parsed = await parse(buffer);
  return parsed.text;
}

export async function extractTextFromSource(
  record: KnowledgeSourceRecord,
  supabase: SupabaseClient
) {
  if (record.type === "text") {
    if (!record.raw_text) {
      throw new Error("Manual text source does not contain content.");
    }
    return record.raw_text;
  }

  if (record.type === "url" || record.type === "youtube") {
    return await fetchUrlContent(record.source);
  }

  if (record.type === "pdf") {
    return await fetchPdfContent(record.source, supabase);
  }

  throw new Error(`Unsupported source type: ${record.type}`);
}

export function chunkText(raw: string) {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return [];
  }

  const words = cleaned.split(" ");
  const chunks: string[] = [];

  for (let i = 0; i < words.length && chunks.length < MAX_CHUNKS; i += MAX_CHUNK_WORDS) {
    const slice = words.slice(i, i + MAX_CHUNK_WORDS).join(" ").trim();
    if (slice.length > 0) {
      chunks.push(slice);
    }
  }

  return chunks;
}
