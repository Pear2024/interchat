import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getServiceSupabaseClient } from "./supabaseServer";

const openAiApiKey = process.env.OPENAI_API_KEY;
const agentModel =
  process.env.LINE_AGENT_MODEL?.trim() ||
  process.env.OPENAI_AGENT_MODEL?.trim() ||
  "gpt-4o-mini";

const systemPrompt =
  process.env.LINE_AGENT_SYSTEM_PROMPT?.trim() ||
  [
    "You are \"Three\", a top-performing Thai sales closer working for Pear's business.",
    "Goals:",
    "1) Diagnose the customer's situation and desired outcome.",
    "2) Ask for missing details before proposing solutions.",
    "3) Pitch the most relevant offer (courses, services, or reseller program) clearly with benefits, price, and next action.",
    "4) Proactively close the sale or invite them to apply as a partner/agent when it makes sense.",
    "Keep replies short (<=3 sentences), empathetic, and in the same language the user used (default to Thai). Always end with a concrete next step or question.",
  ].join(" ");

const MAX_MEMORY_MESSAGES = Math.max(
  Number(process.env.LINE_AGENT_MEMORY_LIMIT ?? 15) || 15,
  1
);

const FALLBACK_REPLY =
  "ระบบติดขัดชั่วคราว รบกวนพิมพ์มาอีกครั้งหรือรออีกสักครู่นะคะ";

let cachedClient: OpenAI | null = null;

function ensureOpenAI() {
  if (!openAiApiKey) {
    console.error(
      "OPENAI_API_KEY is not configured. Unable to run the LINE sales agent."
    );
    return null;
  }

  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey: openAiApiKey });
  }

  return cachedClient;
}

type AgentLogRow = {
  id?: string;
  line_user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: Record<string, unknown>;
};

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
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

async function fetchConversationHistory(
  supabase: SupabaseClient,
  lineUserId: string
): Promise<ConversationMessage[]> {
  try {
    const { data, error } = await supabase
      .from("line_agent_logs")
      .select("role, content")
      .eq("line_user_id", lineUserId)
      .order("created_at", { ascending: true })
      .limit(MAX_MEMORY_MESSAGES);

    if (error) {
      console.warn("Failed to load LINE agent memory", error);
      return [];
    }

    return (data ?? [])
      .filter(
        (row): row is { role: "user" | "assistant"; content: string } =>
          row.role === "user" || row.role === "assistant"
      )
      .map((row) => ({
        role: row.role,
        content: row.content,
      }));
  } catch (error) {
    console.warn("LINE agent memory query failed", error);
    return [];
  }
}

async function appendLogs(
  supabase: SupabaseClient,
  entries: AgentLogRow[]
) {
  if (entries.length === 0) {
    return;
  }

  try {
    const { error } = await supabase
      .from("line_agent_logs")
      .insert(entries.map((entry) => ({ ...entry, metadata: entry.metadata ?? {} })));

    if (error) {
      console.warn("Unable to insert LINE agent logs", error);
    }
  } catch (error) {
    console.warn("LINE agent logging failed", error);
  }
}

export type RunAgentResult = {
  reply: string;
  model: string;
  usage?: {
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
  } | null;
};

export async function runAgent(
  lineUserId: string,
  message: string
): Promise<RunAgentResult> {
  const trimmedMessage = message.trim();

  if (!trimmedMessage) {
    return {
      reply: "ยังไม่ได้รับข้อความนะคะ รบกวนพิมพ์มาอีกครั้งได้เลยค่ะ",
      model: agentModel,
      usage: null,
    };
  }

  const openAi = ensureOpenAI();
  const supabase = getServiceSupabaseClient();

  const history = await fetchConversationHistory(supabase, lineUserId);

  if (!openAi) {
    await appendLogs(supabase, [
      {
        line_user_id: lineUserId,
        role: "user",
        content: trimmedMessage,
        metadata: {
          delivery: "line",
        },
      },
    ]);
    return {
      reply: FALLBACK_REPLY,
      model: agentModel,
      usage: null,
    };
  }

  const inputMessages: Parameters<typeof openAi.responses.create>[0]["input"] =
    [
      {
        role: "system",
        content: systemPrompt,
      },
      ...history,
      {
        role: "user",
        content: trimmedMessage,
      },
    ] as {
      role: "system" | "user" | "assistant";
      content: string;
    }[];

  try {
    const response = await openAi.responses.create({
      model: agentModel,
      input: inputMessages,
      temperature: 0.7,
    });

    const reply = extractFirstText(response) ?? FALLBACK_REPLY;

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

    await appendLogs(supabase, [
      {
        line_user_id: lineUserId,
        role: "user",
        content: trimmedMessage,
        metadata: {
          delivery: "line",
        },
      },
      {
        line_user_id: lineUserId,
        role: "assistant",
        content: reply,
        metadata: {
          delivery: "line",
          model: agentModel,
          usage,
        },
      },
    ]);

    return {
      reply,
      model: agentModel,
      usage,
    };
  } catch (error) {
    console.error("LINE agent OpenAI error", error);

    await appendLogs(supabase, [
      {
        line_user_id: lineUserId,
        role: "user",
        content: trimmedMessage,
        metadata: {
          delivery: "line",
          error: "assistant_failed",
        },
      },
    ]);

    return {
      reply: FALLBACK_REPLY,
      model: agentModel,
      usage: null,
    };
  }
}
