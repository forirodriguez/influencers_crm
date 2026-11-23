import { confirmPhoneVerification } from "../../../../../../modules/reminders/consent";
import { jsonData, jsonError, readSession } from "../../../../../../server/http";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const session = await readSession(req);
    if (!session) return NextResponse.json({ error: { code: "unauthorized", message: "Tenés que iniciar sesión" } }, { status: 401 });
    const body = (await req.json()) as { code?: string };
    const result = await confirmPhoneVerification(session.sub, body.code ?? "");
    return jsonData(result);
  } catch (error) {
    return jsonError(error);
  }
}
