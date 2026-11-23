import { withUser } from "../../../../db/client";
import { ApiError } from "../../../../lib/errors";
import { readCookie } from "../../../../lib/session";
import { listMemberships } from "../../../../modules/identity/queries";
import { readSession } from "../../../../server/http";

export async function requireEditor(req: Request): Promise<{ userId: string; workspaceId: string }> {
  const session = await readSession(req);
  if (!session) throw new ApiError("unauthorized", "Tenés que iniciar sesión", 401);
  const workspaceId = req.headers.get("x-workspace-id") ?? readCookie(req.headers.get("cookie"), "icrm_workspace");
  if (!workspaceId) throw new ApiError("workspace_required", "Falta el workspace", 400);
  const role = await withUser(session.sub, async (db) => {
    const memberships = await listMemberships(db, session.sub);
    return memberships.find((item) => item.workspaceId === workspaceId)?.role ?? null;
  });
  if (!role) throw new ApiError("forbidden", "No pertenecés a este espacio", 403);
  if (role === "viewer") throw new ApiError("forbidden", "No tenés permiso para editar el media kit", 403);
  return { userId: session.sub, workspaceId };
}
