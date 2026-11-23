import { NextResponse } from "next/server";
import { getWhatsAppAdapter } from "../../../../integrations";
import { handleWhatsappPost } from "../../../../modules/reminders/webhook";
import { jsonData } from "../../../../server/http";

export async function GET(req: Request) {
  const challenge = getWhatsAppAdapter().verifySubscription(new URL(req.url).searchParams);
  if (!challenge) return new NextResponse("forbidden", { status: 403 });
  return new NextResponse(challenge, { status: 200 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  const result = await handleWhatsappPost(raw, req.headers.get("x-hub-signature-256"));
  if (result.status !== 200) return NextResponse.json(result.body, { status: result.status });
  return jsonData(result.body);
}
