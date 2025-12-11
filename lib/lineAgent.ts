import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

import { getServiceSupabaseClient } from "./supabaseServer";

const openAiApiKey = process.env.OPENAI_API_KEY;
const agentModel =
  process.env.LINE_AGENT_MODEL?.trim() ||
  process.env.OPENAI_AGENT_MODEL?.trim() ||
  "gpt-4o-mini";

const systemPrompt =
  process.env.LINE_AGENT_SYSTEM_PROMPT?.trim() ||
  [
    "You are \"Three\", a Thai customer success expert for Pear's business.",
    "Goals:",
    "1) Understand the customer's question or context by asking clarifying questions when needed.",
    "2) Provide accurate, concise information strictly based on the knowledge snippets or FAQs supplied. If the answer is not available, say you don't have that information yet.",
    "3) Offer helpful guidance or next steps only when the customer explicitly asks to purchase or needs instructions. Do not push for a sale or close the conversation aggressively.",
    "Keep replies short (<=3 sentences), empathetic, and in the same language the user used (default to Thai).",
    "If you need to send an illustrative image (e.g., product photo), include a Markdown image tag in your reply like this: ![description](https://image-url). Use a single high-quality URL per request.",
    "You must only talk about Three's official products or opportunities that appear in the provided knowledge snippets. If a user asks about anything else, politely explain that you don't have that information.",
  ].join(" ");

const MAX_MEMORY_MESSAGES = Math.max(
  Number(process.env.LINE_AGENT_MEMORY_LIMIT ?? 15) || 15,
  1
);

const MAX_HISTORY_CHARS = Math.max(
  Number(process.env.LINE_AGENT_MAX_HISTORY_CHARS ?? 4000) || 4000,
  500
);

const MAX_KNOWLEDGE_SOURCES = Math.max(
  Number(process.env.LINE_AGENT_MAX_KNOWLEDGE_SOURCES ?? 6) || 6,
  1
);

const MAX_KNOWLEDGE_CHARS_PER_SOURCE = Math.max(
  Number(process.env.LINE_AGENT_MAX_KNOWLEDGE_CHARS ?? 800) || 800,
  200
);

const MAX_KNOWLEDGE_TOTAL_CHARS = Math.max(
  Number(process.env.LINE_AGENT_MAX_KNOWLEDGE_TOTAL_CHARS ?? 6000) || 6000,
  500
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

type KnowledgeChunkRow = {
  content: string;
  source_id: string;
  chunk_index: number;
};

type KnowledgeSourceMeta = {
  id: string;
  title: string | null;
  type: string;
  tags: string[] | null;
};

type KnowledgeSnippet = {
  title: string;
  type: string;
  content: string;
  tags: string[];
};

const HISTORY_TRUNCATION_NOTICE = "\n[message trimmed for length]";

function clampConversationHistory(
  history: ConversationMessage[],
  maxChars: number
) {
  if (!history.length || maxChars <= 0) {
    return [];
  }

  const bounded: ConversationMessage[] = [];
  let remaining = maxChars;

  for (let index = history.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const entry = history[index];
    const content = entry.content ?? "";

    if (content.length === 0) {
      bounded.push(entry);
      continue;
    }

    let nextContent = content;

    if (content.length > remaining) {
      const allowance = Math.max(remaining - HISTORY_TRUNCATION_NOTICE.length, 0);
      nextContent =
        allowance > 0
          ? `${content.slice(0, allowance)}${HISTORY_TRUNCATION_NOTICE}`
          : HISTORY_TRUNCATION_NOTICE.trimStart();
    }

    const size = Math.min(nextContent.length, remaining);

    if (size <= 0) {
      break;
    }

    bounded.push({
      ...entry,
      content: nextContent.slice(0, size),
    });
    remaining -= size;
  }

  return bounded.reverse();
}

function clampKnowledgeSnippets(snippets: KnowledgeSnippet[]) {
  if (!snippets.length) {
    return [];
  }

  const limited: KnowledgeSnippet[] = [];
  let totalChars = 0;

  for (const snippet of snippets.slice(0, MAX_KNOWLEDGE_SOURCES)) {
    const remaining = MAX_KNOWLEDGE_TOTAL_CHARS - totalChars;
    if (remaining <= 0) {
      break;
    }

    const allowedChars = Math.min(MAX_KNOWLEDGE_CHARS_PER_SOURCE, remaining);
    const content =
      snippet.content.length > allowedChars
        ? snippet.content.slice(0, allowedChars)
        : snippet.content;

    limited.push({ ...snippet, content });
    totalChars += content.length;
  }

  return limited;
}

type KnowledgeFaqRow = {
  id: string;
  answer: string;
  usage_count: number | null;
  model: string | null;
};

function normalizeText(input: string) {
  return input.normalize("NFC").toLowerCase();
}

function normalizeTagValue(tag?: string | null) {
  return tag ? normalizeText(tag.trim()) : "";
}

function hashQuestion(input: string, topicKey?: string | null) {
  return createHash("sha1")
    .update(`${input.toLowerCase()}||${topicKey ?? ""}`)
    .digest("hex");
}

async function fetchKnowledgeSnippets(
  supabase: SupabaseClient,
  chunksPerSource = 2
): Promise<KnowledgeSnippet[]> {
  try {
    const { data: sourceRows } = await supabase
      .from("knowledge_sources")
      .select("id,title,type,tags")
      .eq("status", "ready")
      .order("created_at", { ascending: false });

    if (!sourceRows || sourceRows.length === 0) {
      return [];
    }

    const sourceIds = sourceRows.map((row) => row.id);
    const { data: chunkRows } = await supabase
      .from("knowledge_chunks")
      .select("source_id, chunk_index, content")
      .in("source_id", sourceIds)
      .order("chunk_index", { ascending: true });

    if (!chunkRows) {
      return [];
    }

    const snippets: KnowledgeSnippet[] = [];

    (sourceRows as KnowledgeSourceMeta[]).forEach((source) => {
      const related = (chunkRows as KnowledgeChunkRow[])
        .filter((chunk) => chunk.source_id === source.id)
        .sort((a, b) => a.chunk_index - b.chunk_index)
        .slice(0, chunksPerSource);

      if (related.length > 0) {
        snippets.push({
          title: source.title ?? `${source.type.toUpperCase()} source`,
          type: source.type,
          content: related.map((chunk) => chunk.content).join(" "),
          tags: source.tags ?? [],
        });
      }
    });

    return snippets;
  } catch (error) {
    console.warn("Failed to fetch knowledge snippets", error);
    return [];
  }
}

type ActiveTagInfo = {
  normalizedSet: Set<string>;
  display: string[];
  topicKey: string | null;
};

function deriveActiveTags(
  history: ConversationMessage[],
  currentMessage: string,
  snippets: KnowledgeSnippet[]
): ActiveTagInfo {
  if (snippets.length === 0) {
    return {
      normalizedSet: new Set(),
      display: [],
      topicKey: null,
    };
  }

  const normalizedMessages = [
    ...history
      .filter((entry) => entry.role === "user")
      .map((entry) => normalizeText(entry.content)),
    normalizeText(currentMessage),
  ];

  const matched = new Map<string, string>();

  for (const snippet of snippets) {
    for (const rawTag of snippet.tags ?? []) {
      const normalizedTag = normalizeTagValue(rawTag);
      if (!normalizedTag || matched.has(normalizedTag)) {
        continue;
      }

      const hit = normalizedMessages.some((message) =>
        message.includes(normalizedTag)
      );

      if (hit) {
        matched.set(normalizedTag, rawTag);
      }
    }
  }

  const normalizedSet = new Set(matched.keys());
  const topicKey =
    normalizedSet.size > 0 ? Array.from(normalizedSet).sort().join("|") : null;

  return {
    normalizedSet,
    display: Array.from(matched.values()),
    topicKey,
  };
}

function filterKnowledgeSnippets(
  snippets: KnowledgeSnippet[],
  activeTags: Set<string>
) {
  if (!activeTags || activeTags.size === 0) {
    return snippets;
  }

  const filtered = snippets.filter((snippet) => {
    const normalizedSnippetTags = (snippet.tags ?? [])
      .map((tag) => normalizeTagValue(tag))
      .filter(Boolean);

    return normalizedSnippetTags.some((tag) => activeTags.has(tag));
  });

  return filtered.length > 0 ? filtered : snippets;
}

async function fetchCachedFaqAnswer(
  supabase: SupabaseClient,
  hash: string
) {
  try {
    const { data, error } = await supabase
      .from("knowledge_faq")
      .select("id, answer, usage_count, model")
      .eq("question_hash", hash)
      .maybeSingle();

    if (error) {
      console.warn("Failed to load cached FAQ answer", error);
      return null;
    }

    return (data ?? null) as KnowledgeFaqRow | null;
  } catch (error) {
    console.warn("FAQ lookup failed", error);
    return null;
  }
}

async function updateFaqUsage(
  supabase: SupabaseClient,
  id: string,
  currentUsage: number | null
) {
  try {
    await supabase
      .from("knowledge_faq")
      .update({
        usage_count: (currentUsage ?? 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", id);
  } catch (error) {
    console.warn("Failed to update FAQ usage", error);
  }
}

async function storeFaqAnswer(
  supabase: SupabaseClient,
  hash: string,
  question: string,
  answer: string,
  model: string
) {
  try {
    await supabase.from("knowledge_faq").upsert(
      {
        question_hash: hash,
        question_raw: question,
        answer,
        model,
        usage_count: 0,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "question_hash" }
    );
  } catch (error) {
    console.warn("Failed to store FAQ answer", error);
  }
}

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
      .order("created_at", { ascending: false })
      .limit(MAX_MEMORY_MESSAGES);

    if (error) {
      console.warn("Failed to load LINE agent memory", error);
      return [];
    }

    const chronological = (data ?? [])
      .reverse()
      .filter(
        (row): row is { role: "user" | "assistant"; content: string } =>
          row.role === "user" || row.role === "assistant"
      )
      .map((row) => ({
        role: row.role,
        content: row.content,
      }));

    return chronological;
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

async function upsertAgentContact(
  supabase: SupabaseClient,
  lineUserId: string,
  lastMessage: string
) {
  try {
    await supabase.from("line_agent_contacts").upsert(
      {
        line_user_id: lineUserId,
        last_seen_at: new Date().toISOString(),
        last_message: lastMessage.slice(0, 1000),
      },
      { onConflict: "line_user_id" }
    );
  } catch (error) {
    console.warn("Failed to update LINE agent contact", error);
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
  messages?: Array<
    | { type: "text"; text: string }
    | { type: "image"; originalContentUrl: string; previewImageUrl?: string }
  >;
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

  const supabase = getServiceSupabaseClient();
  await upsertAgentContact(supabase, lineUserId, trimmedMessage);
  const fullHistory = await fetchConversationHistory(supabase, lineUserId);
  const history = clampConversationHistory(fullHistory, MAX_HISTORY_CHARS);
  const knowledgeSnippets = await fetchKnowledgeSnippets(supabase);
  const tagInfo = deriveActiveTags(fullHistory, trimmedMessage, knowledgeSnippets);
  const questionHash = hashQuestion(trimmedMessage, tagInfo.topicKey);
  const cachedFaq = await fetchCachedFaqAnswer(supabase, questionHash);

  if (cachedFaq) {
    await updateFaqUsage(supabase, cachedFaq.id, cachedFaq.usage_count ?? 0);
    await appendLogs(supabase, [
      {
        line_user_id: lineUserId,
        role: "user",
        content: trimmedMessage,
        metadata: {
          delivery: "line",
          source: "faq-cache",
          tags: tagInfo.display,
        },
      },
      {
        line_user_id: lineUserId,
        role: "assistant",
        content: cachedFaq.answer,
        metadata: {
          delivery: "line",
          model: cachedFaq.model ?? "faq-cache",
          source: "faq-cache",
          tags: tagInfo.display,
        },
      },
    ]);

    return {
      reply: cachedFaq.answer,
      model: cachedFaq.model ?? "faq-cache",
      usage: null,
    };
  }

  const openAi = ensureOpenAI();

  if (!openAi) {
    await appendLogs(supabase, [
      {
        line_user_id: lineUserId,
        role: "user",
        content: trimmedMessage,
        metadata: {
          delivery: "line",
          tags: tagInfo.display,
        },
      },
    ]);
    return {
      reply: FALLBACK_REPLY,
      model: agentModel,
      usage: null,
    };
  }

  const relevantSnippets = filterKnowledgeSnippets(
    knowledgeSnippets,
    tagInfo.normalizedSet
  );
  const boundedSnippets = clampKnowledgeSnippets(relevantSnippets);

  const knowledgeBlock =
    boundedSnippets.length > 0
      ? [
          {
            role: "system" as const,
            content: [
              "Use the following company knowledge sources when relevant:\n",
              boundedSnippets
                .map(
                  (item, index) =>
                    `${index + 1}. [${item.type}] ${item.title} — ${item.content}`
                )
                .join("\n\n"),
            ].join(""),
          },
        ]
      : [];

  const topicContext =
    tagInfo.display.length > 0
      ? [
          {
            role: "system" as const,
            content: `Current conversation focus: ${tagInfo.display.join(", ")}`,
          },
        ]
      : [];

  const inputMessages: Parameters<typeof openAi.responses.create>[0]["input"] = [
    {
      role: "system",
      content: systemPrompt,
    },
    ...topicContext,
    ...knowledgeBlock,
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
    const imageMatches = Array.from(
      reply.matchAll(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g)
    );
    const cleanedReply = reply.replace(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g, "").trim();

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

    const outgoingMessages: Array<
      | { type: "text"; text: string }
      | { type: "image"; originalContentUrl: string; previewImageUrl?: string }
    > = [];

    if (cleanedReply.length > 0) {
      outgoingMessages.push({ type: "text", text: cleanedReply });
    }

    if (imageMatches.length > 0) {
      imageMatches.forEach((match) => {
        const url = match[1];
        if (url) {
          outgoingMessages.push({
            type: "image",
            originalContentUrl: url,
            previewImageUrl: url,
          });
        }
      });
    }

    await appendLogs(supabase, [
      {
        line_user_id: lineUserId,
        role: "user",
        content: trimmedMessage,
        metadata: {
          delivery: "line",
          tags: tagInfo.display,
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

    await storeFaqAnswer(supabase, questionHash, trimmedMessage, reply, agentModel);

    return {
      reply: cleanedReply || reply,
      model: agentModel,
      usage,
      messages: outgoingMessages,
    } as RunAgentResult & { messages?: typeof outgoingMessages };
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
          tags: tagInfo.display,
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
