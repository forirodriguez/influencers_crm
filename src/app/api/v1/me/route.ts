import { eq } from "drizzle-orm";
import { withUser } from "../../../../db/client";
import { isLocale, type AppLocale } from "../../../../lib/constants";
import { users } from "../../../../modules/identity/schema";
import { listMemberships } from "../../../../modules/identity/queries";
import { updateProfile, type CountryChoice } from "../../../../modules/identity/service";
import { jsonData, jsonError, readSession } from "../../../../server/http";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const session = await readSession(req);
    if (!session) return NextResponse.json({ error: { code: "unauthorized", message: "Tenés que iniciar sesión" } }, { status: 401 });
    const payload = await withUser(session.sub, async (db) => {
      const [user] = await db.select().from(users).where(eq(users.id, session.sub)).limit(1);
      const workspaces = await listMemberships(db, session.sub);
      return { user, workspaces };
    });
    return jsonData(payload);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await readSession(req);
    if (!session) return NextResponse.json({ error: { code: "unauthorized", message: "Tenés que iniciar sesión" } }, { status: 401 });
    const body = (await req.json()) as { name?: string; locale?: AppLocale; timezone?: string; country?: CountryChoice };
    if (body.locale && !isLocale(body.locale)) {
      return NextResponse.json({ error: { code: "invalid_locale", message: "Idioma no soportado" } }, { status: 400 });
    }
    await updateProfile(session.sub, body);
    const response = jsonData({ ok: true });
    if (body.locale) {
      response.cookies.set("icrm_locale", body.locale, { path: "/", sameSite: "lax", httpOnly: false });
    }
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
