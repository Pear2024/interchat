"use server";

import { revalidatePath } from "next/cache";
import { createHash } from "crypto";
import { getServerSupabaseClient, getServiceSupabaseClient } from "@/lib/supabaseServer";
import {
  translateText,
  detectLanguage,
  TRANSLATION_MODEL_VERSION,
  normalizeLanguageCode,
  type TranslationUsage,
} from "@/lib/translation";
import { resolveLanguageCode } from "@/lib/languageCodes";
import { DEMO_ROOM_ID } from "@/lib/chatTypes";
import { ensureCreditBalance, spendCredits, calculateCreditsFromUsage } from "@/lib/credits";

type SendMessagePayload = {
  content: string;
  originalLanguage?: string;
  targetLanguage?: string;
  roomId?: string;
  authorId?: string;
  attachments?: AttachmentPayload[];
};

type AttachmentPayload = {
  url: string;
  name?: string;
  contentType?: string;
  size?: number;
};

const DEFAULT_TARGET_LANGUAGE = "en";
const DEFAULT_ORIGINAL_LANGUAGE = "en";
const OPENAI_TRANSLATION_QUALITY = 0.95;
const IDENTITY_TRANSLATION_MODEL = "identity";
const MAX_TRANSLATION_ATTEMPTS = 2;
function normalizeContent(content: string) {
  return content.trim();
}

export async function sendMessage(payload: SendMessagePayload) {
  const attachments = Array.isArray(payload.attachments)
    ? payload.attachments
        .map((item) => ({
          url: typeof item.url === "string" ? item.url : "",
          name:
            typeof item.name === "string"
              ? item.name
              : typeof item.url === "string"
                ? item.url.split("/").slice(-1)[0]
                : "attachment",
          contentType:
            typeof item.contentType === "string" ? item.contentType : null,
          size:
            typeof item.size === "number"
              ? item.size
              : typeof item.size === "string"
                ? Number.parseInt(item.size, 10) || null
                : null,
        }))
        .filter((item) => item.url)
    : [];

  if (attachments.length > 3) {
    return { error: "Messages may include up to 3 attachments." };
  }

  if (!payload.content && attachments.length === 0) {
    return { error: "Message content is required." };
  }

  const normalizedContent = normalizeContent(payload.content ?? "");
  if (!normalizedContent && attachments.length === 0) {
    return { error: "Please enter a message before sending." };
  }

  const roomId = payload.roomId ?? DEMO_ROOM_ID;

  const serverSupabase = await getServerSupabaseClient();
  const { data: userResult } = await serverSupabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    return { error: "Missing session. Please sign in again." };
  }

  const authorId = payload.authorId ?? user.id;

  if (authorId !== user.id) {
    return { error: "Author mismatch. Please refresh and try again." };
  }

  const isAnonymous =
    user.is_anonymous === true ||
    user.app_metadata?.provider === "anonymous";

  if (isAnonymous && roomId !== DEMO_ROOM_ID) {
    return {
      error: "Guest sessions can only post inside the demo room.",
    };
  }

  const serviceClient = getServiceSupabaseClient();
  await ensureCreditBalance(authorId, 0, serviceClient);

  if (isAnonymous) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count: recentCount } = await serviceClient
      .from("messages")
      .select("id", { head: true, count: "exact" })
      .eq("author_id", user.id)
      .gte("created_at", fiveMinutesAgo);

    if ((recentCount ?? 0) >= 5) {
      return {
        error: "Guest sessions can send up to 5 messages every 5 minutes.",
      };
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { count: dailyCount } = await serviceClient
      .from("messages")
      .select("id", { head: true, count: "exact" })
      .eq("author_id", user.id)
      .gte("created_at", startOfDay.toISOString());

    if ((dailyCount ?? 0) >= 25) {
      return {
        error: "Guest sessions can send up to 25 messages per day.",
      };
    }
  }

  const targetLanguage = normalizeLanguageCode(
    payload.targetLanguage,
    DEFAULT_TARGET_LANGUAGE
  );

  const providedOriginal = resolveLanguageCode(payload.originalLanguage);
  const detectedLanguage =
    providedOriginal ?? (await detectLanguage(normalizedContent));

  const originalLanguage = normalizeLanguageCode(
    detectedLanguage,
    DEFAULT_ORIGINAL_LANGUAGE
  );

  const supabase = serviceClient;

  const shouldTranslate = originalLanguage !== targetLanguage;

  let translatedText = normalizedContent;
  let translationModelVersion = shouldTranslate
    ? TRANSLATION_MODEL_VERSION
    : IDENTITY_TRANSLATION_MODEL;
  let translationQuality = shouldTranslate
    ? OPENAI_TRANSLATION_QUALITY
    : 1;
  let translationUsage: TranslationUsage | null = null;
  let usageType: "translation" | "cache" | "identity" = shouldTranslate
    ? "translation"
    : "identity";
  let creditsCharged = 0;
  let pendingCacheEntry:
    | {
        source_hash: string;
        source_text: string;
        source_language: string;
        target_language: string;
        model_version: string;
        translated_text: string;
        quality_score: number;
        usage_count: number;
        last_used_at: string;
      }
    | null = null;

  if (shouldTranslate) {
    usageType = "cache";

    const sourceHash = createHash("sha256")
      .update(`${originalLanguage}|${normalizedContent}|demo`)
      .digest("hex");

    const { data: cachedTranslation } = await supabase
      .from("translation_cache")
      .select("id, translated_text, usage_count, model_version, quality_score")
      .match({
        source_hash: sourceHash,
        source_language: originalLanguage,
        target_language: targetLanguage,
        context_signature: null,
      })
      .maybeSingle();

    translatedText = cachedTranslation?.translated_text ?? "";
    translationModelVersion =
      cachedTranslation?.model_version ?? TRANSLATION_MODEL_VERSION;
    translationQuality =
      cachedTranslation?.quality_score ?? OPENAI_TRANSLATION_QUALITY;

    if (!translatedText) {
      usageType = "translation";

      let attempts = 0;
      let lastErrorMessage =
        "Unable to translate this message right now. Please try again.";

      while (attempts < MAX_TRANSLATION_ATTEMPTS && !translatedText) {
        const openAiResult = await translateText({
          content: normalizedContent,
          sourceLanguage: originalLanguage,
          targetLanguage,
        });

        if (!openAiResult) {
          attempts += 1;
          continue;
        }

        const translated = openAiResult.text.trim();

        if (!translated) {
          attempts += 1;
          continue;
        }

        if (
          originalLanguage !== targetLanguage &&
          translated.localeCompare(normalizedContent, undefined, {
            sensitivity: "base",
          }) === 0
        ) {
          attempts += 1;
          lastErrorMessage =
            "Translation attempt returned the original text.";
          continue;
        }

        const detectedTarget = await detectLanguage(translated).catch(() => null);
        if (
          detectedTarget &&
          normalizeLanguageCode(detectedTarget, targetLanguage) !== targetLanguage
        ) {
          attempts += 1;
          lastErrorMessage =
            "Translation result was not in the requested language.";
          continue;
        }

        translatedText = translated;
        translationUsage = openAiResult.usage ?? null;
        translationModelVersion = `openai-${openAiResult.model}`;
        translationQuality = OPENAI_TRANSLATION_QUALITY;
        creditsCharged = calculateCreditsFromUsage(translationUsage);
        pendingCacheEntry = {
          source_hash: sourceHash,
          source_text: normalizedContent,
          source_language: originalLanguage,
          target_language: targetLanguage,
          model_version: translationModelVersion,
          translated_text: translatedText,
          quality_score: translationQuality,
          usage_count: 1,
          last_used_at: new Date().toISOString(),
        };
      }

      if (!translatedText) {
        return {
          error: lastErrorMessage,
        };
      }
    } else if (cachedTranslation) {
      translationModelVersion =
        cachedTranslation.model_version ?? TRANSLATION_MODEL_VERSION;
      translationQuality =
        cachedTranslation.quality_score ?? OPENAI_TRANSLATION_QUALITY;
      creditsCharged = 0;
      await supabase
        .from("translation_cache")
        .update({
          usage_count: (cachedTranslation.usage_count ?? 0) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", cachedTranslation.id);
    }
  }

  const messageMetadata =
    attachments.length > 0
      ? {
          attachments: attachments.map((item) => ({
            url: item.url,
            name: item.name,
            type: item.contentType,
            size: item.size,
          })),
        }
      : {};

  const { data: insertedMessage, error: messageError } = await supabase
    .from("messages")
    .insert({
      room_id: roomId,
      author_id: authorId,
      content: normalizedContent,
      original_language: originalLanguage,
      detected_language: originalLanguage,
      metadata: messageMetadata,
    })
    .select("id")
    .single();

  if (messageError || !insertedMessage) {
    return {
      error:
        messageError?.message ||
        "Unable to send message. Please try again later.",
    };
  }

  if (creditsCharged > 0) {
    const creditDescription = `Translation charge for message ${insertedMessage.id}`;
    const spendSuccess = await spendCredits(
      authorId,
      creditsCharged,
      creditDescription,
      insertedMessage.id,
      serviceClient
    );

    if (!spendSuccess) {
      await supabase.from("messages").delete().eq("id", insertedMessage.id);
      return {
        error:
          "Not enough credits to translate this message. Please purchase additional credits and try again.",
      };
    }
  }

  if (pendingCacheEntry) {
    await supabase.from("translation_cache").upsert(pendingCacheEntry, {
      onConflict:
        "source_hash,source_language,target_language,context_signature",
    });
  }

  await supabase
    .from("message_translations")
    .upsert({
      message_id: insertedMessage.id,
      target_language: targetLanguage,
      translated_text: translatedText,
      model_version: translationModelVersion,
      quality_score: translationQuality,
    })
    .eq("message_id", insertedMessage.id)
    .eq("target_language", targetLanguage);

  try {
    const totalTokensForLog = translationUsage
      ? translationUsage.totalTokens ??
        ((translationUsage.inputTokens ?? 0) +
          (translationUsage.outputTokens ?? 0))
      : null;

    await supabase.from("translation_usage_logs").insert({
      message_id: insertedMessage.id,
      user_id: authorId,
      room_id: roomId,
      source_language: originalLanguage,
      target_language: targetLanguage,
      usage_type: usageType,
      model_version: translationModelVersion,
      input_tokens: translationUsage?.inputTokens ?? null,
      output_tokens: translationUsage?.outputTokens ?? null,
      total_tokens: totalTokensForLog,
      credits_charged: creditsCharged,
    });
  } catch (logError) {
    console.error("Failed to record translation usage", logError);
  }

  revalidatePath("/rooms");
  return { success: true };
}
