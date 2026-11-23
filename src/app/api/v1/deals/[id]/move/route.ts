import { moveDeal } from "../../../../../../modules/crm/service";
import { readJson } from "../../../../../../modules/crm/validation";
import { withWorkspace } from "../../../../../../server/http";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withWorkspace(
    req,
    async (ws) => moveDeal(ws.db, { userId: ws.userId, workspaceId: ws.workspaceId }, id, await readJson(req)),
    { roles: ["owner", "manager"] },
  );
}
