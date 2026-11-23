import { createAgencyWorkspace } from "../../../../modules/identity/service";
import { listMemberships } from "../../../../modules/identity/queries";
import { withUser } from "../../../../db/client";
import { jsonData, jsonError, notImplemented, readSession, withWorkspace } from "../../../../server/http";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const session = await readSession(req);
    if (!session) return NextResponse.json({ error: { code: "unauthorized", message: "Tenés que iniciar sesión" } }, { status: 401 });
    const rows = await withUser(session.sub, async (db) => listMemberships(db, session.sub));
    return jsonData(rows);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await readSession(req);
    if (!session) return NextResponse.json({ error: { code: "unauthorized", message: "Tenés que iniciar sesión" } }, { status: 401 });
    const body = (await req.json()) as { name?: string; type?: string };
    if (body.type !== "agency") return notImplemented("identity (por ahora solo type=agency)");
    const created = await createAgencyWorkspace(session.sub, body.name ?? "");
    const response = jsonData(created, 201);
    response.cookies.set("icrm_workspace", created.workspaceId, { path: "/", sameSite: "lax", httpOnly: true });
    return response;
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(req: Request) {
  return withWorkspace(req, async () => notImplemented("identity"));
}
