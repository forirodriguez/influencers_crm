import { revokeWhatsappConsent } from "../../../../../modules/reminders/consent";
import { jsonData, jsonError, readSession } from "../../../../../server/http";
import { NextResponse } from "next/server";

export async function DELETE(req: Request) {
  try {
    const session = await readSession(req);
    if (!session) return NextResponse.json({ error: { code: "unauthorized", message: "Tenés que iniciar sesión" } }, { status: 401 });
    await revokeWhatsappConsent(session.sub);
    return jsonData({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
