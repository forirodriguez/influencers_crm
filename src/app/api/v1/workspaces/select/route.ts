import { NextResponse } from "next/server";
import { withUser } from "../../../../../db/client";
import { listMemberships } from "../../../../../modules/identity/queries";
import { jsonError, readSession } from "../../../../../server/http";

export async function POST(req: Request) {
  try {
    const session = await readSession(req);
    if (!session) return NextResponse.json({ error: { code: "unauthorized", message: "Tenés que iniciar sesión" } }, { status: 401 });
    const body = (await req.json()) as { workspaceId?: string };
    if (!body.workspaceId) {
      return NextResponse.json({ error: { code: "workspace_required", message: "Falta el workspace" } }, { status: 400 });
    }
    const memberships = await withUser(session.sub, async (db) => listMemberships(db, session.sub));
    if (!memberships.some((item) => item.workspaceId === body.workspaceId)) {
      return NextResponse.json({ error: { code: "forbidden", message: "No pertenecés a este espacio" } }, { status: 403 });
    }
    const response = NextResponse.json({ data: { workspaceId: body.workspaceId } });
    response.cookies.set("icrm_workspace", body.workspaceId, { path: "/", sameSite: "lax", httpOnly: true });
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
