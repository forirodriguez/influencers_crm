import { deleteDeliverable, updateDeliverable } from "../../../../../../../modules/crm/service";
import { readJson } from "../../../../../../../modules/crm/validation";
import { withWorkspace } from "../../../../../../../server/http";

export async function PATCH(req: Request, ctx: { params: Promise<{ did: string }> }) {
  const { did } = await ctx.params;
  return withWorkspace(
    req,
    async (ws) => ({
      deliverable: await updateDeliverable(ws.db, { userId: ws.userId, workspaceId: ws.workspaceId }, did, await readJson(req)),
    }),
    { roles: ["owner", "manager"] },
  );
}

export async function DELETE(req: Request, ctx: { params: Promise<{ did: string }> }) {
  const { did } = await ctx.params;
  return withWorkspace(
    req,
    (ws) => deleteDeliverable(ws.db, { userId: ws.userId, workspaceId: ws.workspaceId }, did),
    { roles: ["owner", "manager"] },
  );
}
