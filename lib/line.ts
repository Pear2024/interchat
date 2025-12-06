import { createHmac, timingSafeEqual } from "crypto";
import { Buffer } from "node:buffer";

const lineChannelSecret = process.env.LINE_CHANNEL_SECRET;
const lineChannelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

const LINE_API_BASE_URL = "https://api.line.me/v2/bot";
const LINE_MAX_TEXT_LENGTH = 5000;

export type LineWebhookBody = {
  destination?: string;
  events?: LineWebhookEvent[];
};

export type LineSource =
  | {
      type: "user";
      userId: string;
    }
  | {
      type: "group";
      groupId: string;
      userId?: string;
    }
  | {
      type: "room";
      roomId: string;
      userId?: string;
    }
  | {
    // Unknown/legacy fallbacks
      type: string;
      [key: string]: unknown;
    };

export type LineMessageEvent = {
  type: "message";
  replyToken: string;
  timestamp: number;
  source: LineSource;
  mode?: string;
  webhookEventId?: string;
  deliveryContext?: { isRedelivery?: boolean };
  message:
    | {
        id: string;
        type: "text";
        text: string;
      }
    | {
        id: string;
        type: "image" | "video" | "audio" | "file" | "location" | "sticker";
        [key: string]: unknown;
      };
};

export type LineFollowEvent = {
  type: "follow";
  replyToken: string;
  timestamp: number;
  source: LineSource;
  webhookEventId?: string;
};

export type LineWebhookEvent = LineMessageEvent | LineFollowEvent | Record<string, unknown>;

export type LineTextMessage = {
  type: "text";
  text: string;
};

export type LineImageMessage = {
  type: "image";
  originalContentUrl: string;
  previewImageUrl?: string;
};

export type LineOutgoingMessage = LineTextMessage | LineImageMessage;

function timingSafeCompare(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected, "base64");
  const actualBuffer = Buffer.from(actual, "base64");

  if (expectedBuffer.byteLength !== actualBuffer.byteLength) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function verifyLineSignature(body: string, signature?: string | null) {
  if (!lineChannelSecret) {
    console.warn("LINE_CHANNEL_SECRET is not configured. Skipping signature validation.");
    return true;
  }

  if (!signature) {
    return false;
  }

  const digest = createHmac("sha256", lineChannelSecret).update(body).digest("base64");
  return timingSafeCompare(digest, signature);
}

function ensureAccessToken() {
  if (!lineChannelAccessToken) {
    throw new Error(
      "LINE_CHANNEL_ACCESS_TOKEN is not configured. Unable to send messages to LINE."
    );
  }

  return lineChannelAccessToken;
}

function normalizeOutgoingMessages(input: string | LineOutgoingMessage | LineOutgoingMessage[]) {
  if (typeof input === "string") {
    return [
      {
        type: "text",
        text: truncateText(input),
      } satisfies LineTextMessage,
    ];
  }

  if (Array.isArray(input)) {
    return input.map((message) => {
      if (message.type === "text") {
        return {
          ...message,
          text: truncateText(message.text),
        };
      }
      if (message.type === "image") {
        return {
          ...message,
          previewImageUrl: message.previewImageUrl ?? message.originalContentUrl,
        };
      }
      return message;
    });
  }

  if (input.type === "text") {
    return [
      {
        ...input,
        text: truncateText(input.text),
      },
    ];
  }

  return [
    {
      ...input,
      previewImageUrl: input.previewImageUrl ?? input.originalContentUrl,
    },
  ];
}

function truncateText(text: string) {
  if (text.length <= LINE_MAX_TEXT_LENGTH) {
    return text;
  }
  return `${text.slice(0, LINE_MAX_TEXT_LENGTH - 1)}…`;
}

export async function sendLineReply(replyToken: string, message: string | LineOutgoingMessage | LineOutgoingMessage[]) {
  const messages = normalizeOutgoingMessages(message);

  if (!replyToken || replyToken === "00000000000000000000000000000000") {
    console.warn("Missing reply token for LINE reply. The message will be skipped.");
    return;
  }

  const accessToken = ensureAccessToken();
  const response = await fetch(`${LINE_API_BASE_URL}/message/reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unable to read error body");
    console.error("LINE reply API error", response.status, errorText);
    throw new Error(`LINE reply API responded with status ${response.status}`);
  }
}

export async function pushLineMessage(userId: string, message: string | LineOutgoingMessage | LineOutgoingMessage[]) {
  const messages = normalizeOutgoingMessages(message);
  const accessToken = ensureAccessToken();

  const response = await fetch(`${LINE_API_BASE_URL}/message/push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      to: userId,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unable to read error body");
    console.error("LINE push API error", response.status, errorText);
    throw new Error(`LINE push API responded with status ${response.status}`);
  }
}

export function isLineMessagingConfigured() {
  return Boolean(lineChannelSecret && lineChannelAccessToken);
}
