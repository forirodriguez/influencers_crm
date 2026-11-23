import { completeOnboarding, type CountryChoice } from "../../../../../modules/identity/service";
import { jsonData, jsonError, readSession } from "../../../../../server/http";
import { readCookie } from "../../../../../lib/session";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const session = await readSession(req);
    if (!session) return NextResponse.json({ error: { code: "unauthorized", message: "Tenés que iniciar sesión" } }, { status: 401 });
    const workspaceId = readCookie(req.headers.get("cookie"), "icrm_workspace");
    if (!workspaceId) return NextResponse.json({ error: { code: "workspace_required", message: "Falta el workspace" } }, { status: 400 });
    const body = (await req.json()) as { country?: CountryChoice; timezone?: string };
    const result = await completeOnboarding(session.sub, workspaceId, { country: body.country as CountryChoice, timezone: body.timezone });
    const response = jsonData(result);
    response.cookies.set("icrm_locale", result.locale, { path: "/", sameSite: "lax", httpOnly: false });
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
