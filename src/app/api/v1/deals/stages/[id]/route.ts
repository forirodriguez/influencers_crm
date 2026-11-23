import { deleteStage } from "../../../../../../modules/crm/service";
import { withWorkspace } from "../../../../../../server/http";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withWorkspace(
    req,
    (ws) => deleteStage(ws.db, { userId: ws.userId, workspaceId: ws.workspaceId }, id),
    { roles: ["owner", "manager"] },
  );
}
