import { NextRequest, NextResponse } from "next/server";

import {
  verifyLineSignature,
  sendLineReply,
  type LineWebhookBody,
  type LineWebhookEvent,
  type LineMessageEvent,
  type LineFollowEvent,
} from "@/lib/line";
import { runAgent } from "@/lib/lineAgent";

export const runtime = "nodejs";

const NON_TEXT_MESSAGE_RESPONSE =
  "ตอนนี้รองรับเฉพาะข้อความตัวอักษรค่ะ ฝากพิมพ์มาได้เลยนะคะ";
const FOLLOW_GREETING =
  "ขอบคุณที่ทักมาหาแพร์นะคะ ฉันชื่อทรี พร้อมช่วยปิดการขายและตอบทุกคำถามค่ะ 😊";

function parseRequestBody(rawBody: string): LineWebhookBody | null {
  try {
    return JSON.parse(rawBody) as LineWebhookBody;
  } catch (error) {
    console.warn("Failed to parse LINE webhook body", error);
    return null;
  }
}

function extractTextMessage(message: LineMessageEvent["message"]): string | null {
  if (
    typeof message === "object" &&
    message !== null &&
    message.type === "text" &&
    typeof (message as { text?: unknown }).text === "string"
  ) {
    return (message as { text: string }).text;
  }

  return null;
}

async function handleMessageEvent(event: LineMessageEvent) {
  const message = event.message;
  const userId = event.source?.type === "user" ? event.source.userId : event.source?.userId;

  if (!userId) {
    console.warn("LINE message event is missing userId", event);
    return;
  }

  const text = extractTextMessage(message);
  if (!text) {
    await sendLineReply(event.replyToken, NON_TEXT_MESSAGE_RESPONSE);
    return;
  }

  const agentResult = await runAgent(userId, text);
  await sendLineReply(event.replyToken, agentResult.reply);
}

async function handleFollowEvent(event: LineFollowEvent) {
  await sendLineReply(event.replyToken, FOLLOW_GREETING);
}

async function handleEvent(event: LineWebhookEvent) {
  if (event.type === "message") {
    await handleMessageEvent(event);
    return;
  }

  if (event.type === "follow") {
    await handleFollowEvent(event);
  }
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-line-signature");
  const rawBody = await request.text();

  const isValid = verifyLineSignature(rawBody, signature);
  if (!isValid) {
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 401 }
    );
  }

  const body = parseRequestBody(rawBody);

  if (!body || !Array.isArray(body.events)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const results = await Promise.allSettled(
    body.events.map((event) => handleEvent(event))
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("LINE webhook handler error", result.reason);
    }
  }

  return NextResponse.json({ success: true });
}
