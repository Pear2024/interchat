import { NextResponse } from "next/server";

const ingestionKey = process.env.KNOWLEDGE_INGESTION_KEY;

function resolveBaseUrl() {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL ?? "http://localhost:3000";
  if (envUrl.startsWith("http://") || envUrl.startsWith("https://")) {
    return envUrl;
  }
  return `https://${envUrl}`;
}

export async function POST() {
  if (!ingestionKey) {
    return NextResponse.json(
      { ok: false, error: "KNOWLEDGE_INGESTION_KEY is not configured" },
      { status: 500 }
    );
  }

  const targetUrl = new URL("/api/knowledge/process", resolveBaseUrl()).toString();

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ingestionKey}`,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: data?.error ?? "Ingestion request failed",
          status: response.status,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("Failed to trigger ingestion", error);
    return NextResponse.json(
      { ok: false, error: "Unable to trigger ingestion" },
      { status: 500 }
    );
  }
}
