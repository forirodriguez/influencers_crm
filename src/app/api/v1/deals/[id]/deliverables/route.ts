import { listDeliverables } from "../../../../../../modules/crm/queries";
import { createDeliverable } from "../../../../../../modules/crm/service";
import { readJson } from "../../../../../../modules/crm/validation";
import { withWorkspace } from "../../../../../../server/http";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withWorkspace(req, async ({ db, workspaceId }) => ({
    deliverables: await listDeliverables(db, workspaceId, { dealId: id }),
  }));
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withWorkspace(
    req,
    async (ws) => ({
      deliverable: await createDeliverable(ws.db, { userId: ws.userId, workspaceId: ws.workspaceId }, await readJson(req), id),
    }),
    { roles: ["owner", "manager"] },
  );
}
