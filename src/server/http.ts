import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withUser } from "../db/client";
import type { Db } from "../db/types";
import { ApiError } from "../lib/errors";
import { captureException } from "../lib/observability/sentry";
import { readCookie, verifySessionToken } from "../lib/session";
import { listMemberships } from "../modules/identity/queries";
import { users } from "../modules/identity/schema";

export type WorkspaceRole = "owner" | "manager" | "viewer";

export type WorkspaceContext = {
  db: Db;
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  req: Request;
};

export function jsonData(data: unknown, status = 200): NextResponse {
  return new NextResponse(
    JSON.stringify({ data }, (_key, value) => (typeof value === "bigint" ? value.toString() : value)),
    { status, headers: { "content-type": "application/json" } },
  );
}

export function jsonError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  void captureException(error);
  return NextResponse.json({ error: { code: "internal", message: "Error interno" } }, { status: 500 });
}

export function notImplemented(moduleName: string): NextResponse {
  return NextResponse.json(
    { error: { code: "not_implemented", message: `Esta escritura la implementa el módulo ${moduleName}` } },
    { status: 501 },
  );
}

export async function readSession(req: Request) {
  return verifySessionToken(readCookie(req.headers.get("cookie"), "icrm_session"));
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "local";
  return "local";
}

export async function withWorkspace(
  req: Request,
  handler: (ctx: WorkspaceContext) => Promise<unknown>,
  options?: { roles?: WorkspaceRole[] },
): Promise<NextResponse> {
  try {
    const session = await readSession(req);
    if (!session) throw new ApiError("unauthorized", "Tenés que iniciar sesión", 401);
    const workspaceId = req.headers.get("x-workspace-id") ?? readCookie(req.headers.get("cookie"), "icrm_workspace");
    if (!workspaceId) throw new ApiError("workspace_required", "Falta el workspace", 400);
    const body = await withUser(session.sub, async (db) => {
      const [account] = await db.select({ deletedAt: users.deletedAt }).from(users).where(eq(users.id, session.sub)).limit(1);
      if (!account || account.deletedAt) throw new ApiError("unauthorized", "Tenés que iniciar sesión", 401);
      const memberships = await listMemberships(db, session.sub);
      const membership = memberships.find((item) => item.workspaceId === workspaceId);
      if (!membership) throw new ApiError("forbidden", "No pertenecés a este espacio", 403);
      if (options?.roles && !options.roles.includes(membership.role)) {
        throw new ApiError("forbidden", "No tenés permiso para esto", 403);
      }
      return handler({ db, userId: session.sub, workspaceId, role: membership.role, req });
    });
    if (body instanceof NextResponse || body instanceof Response) return body as NextResponse;
    return jsonData(body);
  } catch (error) {
    return jsonError(error);
  }
}
