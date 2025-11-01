import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  detectLanguage,
  normalizeLanguageCode,
  translateText,
} from "@/lib/translation";
import {
  calculateCreditsFromUsage,
  fetchCreditBalance,
  spendCredits,
} from "@/lib/credits";
import {
  getServerSupabaseClient,
  getServiceSupabaseClient,
} from "@/lib/supabaseServer";

export async function POST(request: NextRequest) {
  try {
    const { text, targetLanguage } = (await request.json()) as {
      text?: string;
      targetLanguage?: string;
    };

    if (!text || !targetLanguage) {
      return NextResponse.json(
        { error: "Missing text or target language" },
        { status: 400 }
      );
    }

    const supabase = await getServerSupabaseClient();
    const { data: userResult } = await supabase.auth.getUser();
    const user = userResult.user;

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const serviceClient = getServiceSupabaseClient();
    const currentBalance = await fetchCreditBalance(user.id, serviceClient);
    if (currentBalance <= 0) {
      return NextResponse.json(
        {
          error: "Not enough credits to translate. Please top up your balance.",
          remainingCredits: 0,
        },
        { status: 402 }
      );
    }

    const normalizedTarget = normalizeLanguageCode(targetLanguage, "en");
    const detectedSource =
      (await detectLanguage(text)) ?? normalizeLanguageCode(undefined, "en");

    if (detectedSource === normalizedTarget) {
      return NextResponse.json({
        sourceLanguage: detectedSource,
        translation: text,
        creditsCharged: 0,
        remainingCredits: currentBalance,
      });
    }

    const translationResult = await translateText({
      content: text,
      sourceLanguage: detectedSource,
      targetLanguage: normalizedTarget,
    });

    const translatedText = translationResult?.text?.trim();
    const responseText =
      translatedText && translatedText.length > 0 ? translatedText : text;

    let creditsCharged = 0;
    let remainingCredits = currentBalance;

    if (translatedText && translatedText !== text) {
      creditsCharged = calculateCreditsFromUsage(translationResult?.usage ?? null);
      if (creditsCharged > 0) {
        try {
          const description = "Voice translator usage";
          const referenceId = randomUUID();
          const spendSuccess = await spendCredits(
            user.id,
            creditsCharged,
            description,
            referenceId,
            serviceClient
          );

          if (!spendSuccess) {
            return NextResponse.json(
              {
                error:
                  "Not enough credits to translate. Please top up your balance.",
                requiredCredits: creditsCharged,
                remainingCredits: currentBalance,
              },
              { status: 402 }
            );
          }

          remainingCredits = await fetchCreditBalance(user.id, serviceClient);
        } catch (creditError) {
          console.error("Failed to spend credits for voice translation", creditError);
          return NextResponse.json(
            {
              error:
                "Unable to charge credits for this translation. Please try again later.",
            },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({
      sourceLanguage: detectedSource,
      translation: responseText,
      creditsCharged,
      remainingCredits,
    });
  } catch (error) {
    console.error("Translation API error", error);
    return NextResponse.json(
      { error: "Translation failed" },
      { status: 500 }
    );
  }
}
