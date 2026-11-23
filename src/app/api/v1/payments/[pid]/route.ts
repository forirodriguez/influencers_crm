import { updatePayment } from "../../../../../modules/crm/service";
import { readJson } from "../../../../../modules/crm/validation";
import { withWorkspace } from "../../../../../server/http";

export async function PATCH(req: Request, ctx: { params: Promise<{ pid: string }> }) {
  const { pid } = await ctx.params;
  return withWorkspace(
    req,
    async (ws) => ({
      payment: await updatePayment(ws.db, { userId: ws.userId, workspaceId: ws.workspaceId }, pid, await readJson(req)),
    }),
    { roles: ["owner", "manager"] },
  );
}
