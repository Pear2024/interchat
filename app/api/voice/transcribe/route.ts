import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { APIError } from "openai/error";

export const runtime = "nodejs";

import {
  fetchCreditBalance,
  spendCredits,
} from "@/lib/credits";
import {
  getServerSupabaseClient,
  getServiceSupabaseClient,
} from "@/lib/supabaseServer";

const openAiApiKey = process.env.OPENAI_API_KEY;
const transcriptionModel =
  process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() ||
  "gpt-4o-mini-transcribe";

const CREDIT_INTERVAL_MS = Number(
  process.env.WHISPER_CREDIT_INTERVAL_MS ?? 15_000
);
const FALLBACK_BYTES_PER_INTERVAL = Number(
  process.env.WHISPER_BYTES_PER_INTERVAL ?? 120_000
);

function calculateCreditsForAudio(
  durationMs: number,
  sizeBytes: number
): number {
  if (Number.isFinite(durationMs) && durationMs > 0) {
    return Math.max(1, Math.ceil(durationMs / CREDIT_INTERVAL_MS));
  }

  if (Number.isFinite(sizeBytes) && sizeBytes > 0) {
    return Math.max(1, Math.ceil(sizeBytes / FALLBACK_BYTES_PER_INTERVAL));
  }

  return 1;
}

function ensureOpenAI() {
  if (!openAiApiKey) {
    console.error(
      "OPENAI_API_KEY is not configured. Please add it to your environment."
    );
    return null;
  }
  return new OpenAI({ apiKey: openAiApiKey });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getServerSupabaseClient();
    const { data: userResult } = await supabase.auth.getUser();
    const user = userResult.user;

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get("audio");
    const durationRaw = formData.get("durationMs");
    const language = (formData.get("language") as string | null) ?? null;
    const normalizedLanguage = normalizeLanguageHint(language);

    if (!(audioFile instanceof File)) {
      return NextResponse.json(
        { error: "Audio file is required" },
        { status: 400 }
      );
    }

    const durationMs = Number(durationRaw ?? 0);
    const client = ensureOpenAI();
    if (!client) {
      return NextResponse.json(
        { error: "Transcription service unavailable" },
        { status: 503 }
      );
    }

    const serviceClient = getServiceSupabaseClient();
    const currentBalance = await fetchCreditBalance(user.id, serviceClient);

    if (currentBalance <= 0) {
      return NextResponse.json(
        {
          error:
            "Not enough credits to transcribe. Please top up your balance.",
          remainingCredits: 0,
        },
        { status: 402 }
      );
    }

    const creditsNeeded = calculateCreditsForAudio(
      durationMs,
      audioFile.size ?? 0
    );

    if (creditsNeeded > currentBalance) {
      return NextResponse.json(
        {
          error:
            "Not enough credits to transcribe. Please top up your balance.",
          requiredCredits: creditsNeeded,
          remainingCredits: currentBalance,
        },
        { status: 402 }
      );
    }

    const fileForUpload = await OpenAI.toFile(
      audioFile.stream(),
      audioFile.name || "audio.webm"
    );

    const transcription = await client.audio.transcriptions.create({
      model: transcriptionModel,
      file: fileForUpload,
      response_format: "verbose_json",
      temperature: 0,
      // Whisper accepts undefined language for auto-detect; otherwise use provided language
      language: normalizedLanguage ?? undefined,
    });

    let creditsCharged = 0;
    let remainingCredits = currentBalance;

    if (creditsNeeded > 0) {
      const description = "Voice transcription usage";
      const referenceId = randomUUID();
      try {
        const success = await spendCredits(
          user.id,
          creditsNeeded,
          description,
          referenceId,
          serviceClient
        );

        if (!success) {
          return NextResponse.json(
            {
              error:
                "Not enough credits to transcribe. Please top up your balance.",
              requiredCredits: creditsNeeded,
              remainingCredits: currentBalance,
            },
            { status: 402 }
          );
        }

        creditsCharged = creditsNeeded;
        remainingCredits = await fetchCreditBalance(user.id, serviceClient);
      } catch (creditError) {
        console.error(
          "Failed to spend credits for voice transcription",
          creditError
        );
        return NextResponse.json(
          {
            error:
              "Unable to charge credits for this transcription. Please try again later.",
          },
          { status: 500 }
        );
      }
    }

    const segments = Array.isArray(transcription.segments)
      ? transcription.segments.map((segment) => ({
          id: segment.id,
          start: segment.start,
          end: segment.end,
          text: segment.text,
        }))
      : [];

    return NextResponse.json({
      text: transcription.text ?? "",
      language: transcription.language ?? null,
      duration: transcription.duration ?? null,
      creditsCharged,
      remainingCredits,
      segments,
    });
  } catch (error) {
    console.error("Transcription API error", error);
    if (error instanceof APIError) {
      return NextResponse.json(
        {
          error: "Transcription failed",
          detail: error.message,
        },
        { status: error.status ?? 500 }
      );
    }
    return NextResponse.json(
      { error: "Transcription failed" },
      { status: 500 }
    );
  }
}
const LANGUAGE_OVERRIDES: Record<string, string> = {
  jp: "ja",
  fil: "tl",
};

function normalizeLanguageHint(language?: string | null) {
  if (!language) {
    return null;
  }

  const trimmed = language.trim();
  if (!trimmed || trimmed.toLowerCase() === "auto") {
    return null;
  }

  const base = trimmed.split(/[-_]/)[0]?.toLowerCase() ?? "";
  if (!base) {
    return null;
  }

  return LANGUAGE_OVERRIDES[base] ?? base;
}
