import { followUpForDeal } from "../../../../../../modules/crm/service";
import { withWorkspace } from "../../../../../../server/http";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const channel = new URL(req.url).searchParams.get("channel") === "email" ? "email" : "whatsapp";
  return withWorkspace(req, async (ws) =>
    followUpForDeal(ws.db, { userId: ws.userId, workspaceId: ws.workspaceId }, id, channel),
  );
}
