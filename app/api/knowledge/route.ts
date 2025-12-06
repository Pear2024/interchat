import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient, getServiceSupabaseClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

const KNOWLEDGE_BUCKET = process.env.KNOWLEDGE_STORAGE_BUCKET?.trim() || "knowledge-sources";

async function ensureAuthenticatedUser() {
  const supabase = await getServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

async function insertKnowledgeSource(payload: {
  submitted_by: string;
  type: "url" | "pdf" | "youtube" | "text";
  title?: string | null;
  source: string;
  status?: string;
  raw_text?: string | null;
}) {
  const serviceClient = getServiceSupabaseClient();
  const { data, error } = await serviceClient
    .from("knowledge_sources")
    .insert({
      submitted_by: payload.submitted_by,
      type: payload.type,
      title: payload.title,
      source: payload.source,
      status: payload.status ?? "pending",
      raw_text: payload.raw_text ?? null,
    })
    .select("id,type,title,source,status,error_message,created_at")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function handleJsonPayload(request: NextRequest, userId: string) {
  const body = (await request.json()) as {
    type?: string;
    title?: string | null;
    source?: string;
    content?: string;
  };

  const type = body.type?.trim();
  const source = body.source?.trim();
  const title = body.title?.trim() ?? null;
  const content = body.content?.trim() ?? null;

  if (!type) {
    return NextResponse.json({ error: "Missing type" }, { status: 400 });
  }

  if (type === "text") {
    if (!content) {
      return NextResponse.json({ error: "Content is required for text sources" }, { status: 400 });
    }
    const record = await insertKnowledgeSource({
      submitted_by: userId,
      type: "text",
      title: title || "Manual entry",
      source: "manual",
      raw_text: content,
      status: "pending",
    });
    return NextResponse.json({ data: record });
  }

  if (type !== "url" && type !== "youtube") {
    return NextResponse.json({ error: "Unsupported knowledge source type" }, { status: 400 });
  }

  if (!source) {
    return NextResponse.json({ error: "Source is required" }, { status: 400 });
  }

  const record = await insertKnowledgeSource({
    submitted_by: userId,
    type,
    title: title || null,
    source,
  });

  return NextResponse.json({ data: record });
}

async function handlePdfPayload(request: NextRequest, userId: string) {
  const formData = await request.formData();
  const type = (formData.get("type") as string | null)?.trim();
  const title = (formData.get("title") as string | null)?.trim() ?? null;
  const file = formData.get("file");

  if (type !== "pdf") {
    return NextResponse.json({ error: "Invalid PDF payload" }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "PDF file is required" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const safeName = file.name?.replace(/[^\w.\-]/g, "_") || "document.pdf";
  const storagePath = `${userId}/${Date.now()}-${safeName}`;

  const serviceClient = getServiceSupabaseClient();
  const { error: uploadError } = await serviceClient.storage
    .from(KNOWLEDGE_BUCKET)
    .upload(storagePath, buffer, {
      cacheControl: "3600",
      contentType: file.type || "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    console.error("Failed to upload PDF to bucket", uploadError);
    return NextResponse.json({ error: "Unable to store PDF file" }, { status: 500 });
  }

  const record = await insertKnowledgeSource({
    submitted_by: userId,
    type: "pdf",
    title: title || safeName,
    source: `${KNOWLEDGE_BUCKET}:${storagePath}`,
    status: "pending",
  });

  return NextResponse.json({ data: record });
}

export async function POST(request: NextRequest) {
  const user = await ensureAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      return await handlePdfPayload(request, user.id);
    }

    return await handleJsonPayload(request, user.id);
  } catch (error) {
    console.error("Knowledge source submission error", error);
    return NextResponse.json({ error: "Unable to submit knowledge source" }, { status: 500 });
  }
}
