import { NextResponse } from "next/server";
import { getWhatsAppAdapter } from "../../../../integrations";
import { parseCommand } from "../../../../modules/reminders/commands";
import { jsonData } from "../../../../server/http";

export async function GET(req: Request) {
  const challenge = getWhatsAppAdapter().verifySubscription(new URL(req.url).searchParams);
  if (!challenge) return new NextResponse("forbidden", { status: 403 });
  return new NextResponse(challenge, { status: 200 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  const adapter = getWhatsAppAdapter();
  if (!adapter.verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: { code: "invalid_signature", message: "Firma inválida" } }, { status: 401 });
  }
  let payload: unknown = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    return NextResponse.json({ error: { code: "invalid_json", message: "JSON inválido" } }, { status: 400 });
  }
  const messages = adapter.parseInbound(payload);
  return jsonData({
    received: messages.length,
    executed: false,
    commands: messages.map((message) => ({
      waMessageId: message.id,
      from: message.from,
      command: parseCommand(message.body),
    })),
  });
}
