import { listInvitations } from "../../../../../../modules/identity/queries";
import { createInvitation } from "../../../../../../modules/identity/service";
import { getEnv } from "../../../../../../lib/env.server";
import { jsonData, withWorkspace } from "../../../../../../server/http";

type Params = { params: Promise<{ id: string }> };

function scoped(req: Request, id: string) {
  const headers = new Headers(req.headers);
  headers.set("x-workspace-id", id);
  return new Request(req.url, { method: req.method, headers });
}

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  return withWorkspace(scoped(req, id), async ({ db, workspaceId, role }) => {
    if (role === "viewer") return { invitations: [] };
    return { invitations: await listInvitations(db, workspaceId) };
  }, { roles: ["owner", "manager"] });
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const body = (await req.json()) as { email?: string; role?: "manager" | "viewer" };
  return withWorkspace(scoped(req, id), async ({ userId, workspaceId }) => {
    const created = await createInvitation({
      userId,
      workspaceId,
      email: body.email ?? "",
      role: body.role === "viewer" ? "viewer" : "manager",
    });
    const devLink =
      getEnv().AUTH_DEV_EXPOSE_LINKS === "true"
        ? `${getEnv().NEXT_PUBLIC_APP_URL}/ajustes?invitation=${created.token}`
        : undefined;
    return jsonData({ invitationId: created.invitationId, devLink }, 201);
  }, { roles: ["owner"] });
}
