import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withUser } from "../../../../db/client";
import { ACTIVE_LOCALE, type AppLocale } from "../../../../lib/constants";
import { softDeleteAccount } from "../../../../modules/identity/privacy";
import { users } from "../../../../modules/identity/schema";
import { listMemberships } from "../../../../modules/identity/queries";
import { updateProfile, type CountryChoice } from "../../../../modules/identity/service";
import { clearAuthCookies } from "../../../../server/cookies";
import { clientIp, jsonData, jsonError, readSession } from "../../../../server/http";

export async function GET(req: Request) {
  try {
    const session = await readSession(req);
    if (!session) return NextResponse.json({ error: { code: "unauthorized", message: "Tenés que iniciar sesión" } }, { status: 401 });
    const payload = await withUser(session.sub, async (db) => {
      const [user] = await db.select().from(users).where(eq(users.id, session.sub)).limit(1);
      if (!user || user.deletedAt) return null;
      const workspaces = await listMemberships(db, session.sub);
      return { user, workspaces };
    });
    if (!payload) return NextResponse.json({ error: { code: "unauthorized", message: "Tenés que iniciar sesión" } }, { status: 401 });
    return jsonData(payload);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await readSession(req);
    if (!session) return NextResponse.json({ error: { code: "unauthorized", message: "Tenés que iniciar sesión" } }, { status: 401 });
    const body = (await req.json()) as { confirm?: string };
    await softDeleteAccount(session.sub, body.confirm ?? "", clientIp(req));
    const response = jsonData({ ok: true });
    clearAuthCookies(response);
    return response;
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await readSession(req);
    if (!session) return NextResponse.json({ error: { code: "unauthorized", message: "Tenés que iniciar sesión" } }, { status: 401 });
    const body = (await req.json()) as {
      name?: string;
      locale?: AppLocale;
      timezone?: string;
      country?: CountryChoice;
      emailReminders?: boolean;
      dailySummary?: boolean;
    };
    if (body.locale && body.locale !== ACTIVE_LOCALE) {
      return NextResponse.json({ error: { code: "invalid_locale", message: "Por ahora la interfaz está en español de Uruguay" } }, { status: 400 });
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
