import { listPaymentExpectations } from "../../../../../../modules/crm/queries";
import { createPayment } from "../../../../../../modules/crm/service";
import { readJson } from "../../../../../../modules/crm/validation";
import { withWorkspace } from "../../../../../../server/http";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withWorkspace(req, async ({ db, workspaceId }) => ({
    payments: await listPaymentExpectations(db, workspaceId, { dealId: id }),
  }));
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withWorkspace(
    req,
    async (ws) => ({
      payment: await createPayment(ws.db, { userId: ws.userId, workspaceId: ws.workspaceId }, id, await readJson(req)),
    }),
    { roles: ["owner", "manager"] },
  );
}
