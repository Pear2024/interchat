import OpenAI from "openai";
import {
  SUPPORTED_LANGUAGE_CODES,
  ensureSupportedLanguageCode,
  resolveLanguageCode,
} from "./languageCodes";

const openAiApiKey = process.env.OPENAI_API_KEY;
const translationModel =
  process.env.OPENAI_TRANSLATION_MODEL?.trim() || "gpt-4o-mini";
const detectionModel =
  process.env.OPENAI_DETECTION_MODEL?.trim() || translationModel;

let client: OpenAI | null = null;

function getClient() {
  if (!openAiApiKey) {
    console.error(
      "OPENAI_API_KEY is not configured. Please add it to your environment."
    );
    return null;
  }

  if (!client) {
    client = new OpenAI({ apiKey: openAiApiKey });
  }

  return client;
}

export const TRANSLATION_MODEL_VERSION = `openai-${translationModel}`;
export const DETECTION_MODEL_VERSION = `openai-${detectionModel}`;

export type TranslationRequest = {
  content: string;
  sourceLanguage: string;
  targetLanguage: string;
};

export type TranslationUsage = {
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
};

export type TranslationResult = {
  text: string;
  usage: TranslationUsage | null;
  model: string;
};

function extractFirstText(response: OpenAI.Responses.Response) {
  if (typeof response.output_text === "string") {
    const text = response.output_text.trim();
    if (text.length > 0) {
      return text;
    }
  }

  const output = response.output?.[0];

  if (output?.type === "message") {
    for (const part of output.content ?? []) {
      const text = (part as { text?: string }).text;
      if (typeof text === "string" && text.trim().length > 0) {
        return text.trim();
      }
    }
  }

  if (
    output &&
    "text" in output &&
    typeof (output as { text?: string }).text === "string"
  ) {
    const inlineText = (output as { text: string }).text.trim();
    if (inlineText.length > 0) {
      return inlineText;
    }
  }

  return null;
}

export async function translateText({
  content,
  sourceLanguage,
  targetLanguage,
}: TranslationRequest): Promise<TranslationResult | null> {
  const sdk = getClient();

  if (!sdk) {
    return null;
  }

  try {
    const response = await sdk.responses.create({
      model: translationModel,
      input: [
        {
          role: "system",
          content: `You are a professional translator. Translate the user message from ${sourceLanguage} to ${targetLanguage}. Keep formatting, emoji, and tone. Reply using only the translated text without any explanation.`,
        },
        {
          role: "user",
          content,
        },
      ],
    });

    const text = extractFirstText(response);
    if (!text) {
      return null;
    }

    const usageData = response.usage as
      | {
          input_tokens?: number | null;
          output_tokens?: number | null;
          total_tokens?: number | null;
        }
      | undefined;

    const usage = usageData
      ? {
          inputTokens: usageData.input_tokens ?? null,
          outputTokens: usageData.output_tokens ?? null,
          totalTokens: usageData.total_tokens ?? null,
        }
      : null;

    return {
      text,
      usage,
      model: translationModel,
    };
  } catch (error) {
    console.error("OpenAI translation error", error);
    return null;
  }
}

export async function detectLanguage(input: string): Promise<string | null> {
  const sdk = getClient();

  if (!sdk) {
    return null;
  }

  try {
    const response = await sdk.responses.create({
      model: detectionModel,
      input: [
        {
          role: "system",
          content: [
            "Identify the main human language of the user input. ",
            "Answer using only one language code from this list: ",
            SUPPORTED_LANGUAGE_CODES.join(", "),
            '. If you are unsure or the language is not listed, respond with "en".',
          ].join(""),
        },
        {
          role: "user",
          content: input,
        },
      ],
    });

    const raw = extractFirstText(response);
    if (!raw) {
      return null;
    }

    return resolveLanguageCode(raw);
  } catch (error) {
    console.error("OpenAI language detection error", error);
    return null;
  }
}

export function normalizeLanguageCode(code?: string | null, fallback = "en") {
  return ensureSupportedLanguageCode(code, fallback);
}
