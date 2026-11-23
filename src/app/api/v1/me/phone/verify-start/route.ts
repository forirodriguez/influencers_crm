import { eq } from "drizzle-orm";
import { withUser } from "../../../../../../db/client";
import { users } from "../../../../../../modules/identity/schema";
import { startPhoneVerification } from "../../../../../../modules/reminders/consent";
import { jsonData, jsonError, readSession } from "../../../../../../server/http";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const session = await readSession(req);
    if (!session) return NextResponse.json({ error: { code: "unauthorized", message: "Tenés que iniciar sesión" } }, { status: 401 });
    const body = (await req.json()) as { phone?: string; acceptConsent?: boolean };
    const [user] = await withUser(session.sub, async (db) => db.select({ country: users.country }).from(users).where(eq(users.id, session.sub)).limit(1));
    const result = await startPhoneVerification(session.sub, {
      phone: body.phone ?? "",
      acceptConsent: body.acceptConsent === true,
      country: user?.country ?? undefined,
    });
    return jsonData(result);
  } catch (error) {
    return jsonError(error);
  }
}
