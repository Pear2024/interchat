// app/api/line/webhook/route.ts
import { NextRequest } from "next/server";
import { runAgent } from "@/lib/lineAgent";
import { sendLineReply } from "@/lib/line";

const FALLBACK_REPLY =
  "ตอนนี้ทรีตอบได้แค่ข้อความตัวอักษรนะคะ 😊\nลองพิมพ์เป็นข้อความส่งมาอีกครั้งได้เลยค่ะ";

type LineMessage = {
  type: string;
  text?: string;
};

type LineSource = {
  userId?: string | null;
};

type LineMessageEvent = {
  type: "message";
  replyToken: string;
  source: LineSource;
  message: LineMessage;
};

type LineWebhookBody = {
  events?: LineMessageEvent[];
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as LineWebhookBody;
  const events = body.events ?? [];

  await Promise.all(
    events.map(async (event) => {
      if (event.type !== "message") return;
      await handleMessageEvent(event);
    })
  );

  return new Response("OK");
}

function getTextFromMessage(message: LineMessage): string {
  // ตรวจ runtime ให้ชัวร์ว่าเป็น text message
  if (
    typeof message === "object" &&
    message !== null &&
    message.type === "text" &&
    typeof message.text === "string"
  ) {
    return message.text.trim();
  }
  return "";
}

async function handleMessageEvent(event: LineMessageEvent) {
  const { message, replyToken, source } = event;

  const userId: string = source.userId ?? "anonymous";

  // ดึง text ออกมาด้วย helper ที่รีเทิร์น string เสมอ
  const rawText = getTextFromMessage(message);
  const text: string = rawText.trim();

  // ถ้าไม่ใช่ข้อความ หรือเป็นข้อความว่าง → ตอบ fallback แล้วจบ
  if (!text) {
    await sendLineReply(replyToken, FALLBACK_REPLY);
    return;
  }

  // ✅ ตรงนี้ TypeScript รู้แน่นอนว่า text เป็น string
  const agentResult = await runAgent(userId, text);
  const outgoing = Array.isArray(agentResult.messages) && agentResult.messages.length > 0
    ? agentResult.messages
    : agentResult.reply;
  await sendLineReply(replyToken, outgoing);
}
