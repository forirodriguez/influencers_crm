import { deleteContact, updateContact } from "../../../../../../../modules/crm/service";
import { readJson } from "../../../../../../../modules/crm/validation";
import { withWorkspace } from "../../../../../../../server/http";

const editors = ["owner", "manager"] as const;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; cid: string }> }) {
  const { id, cid } = await ctx.params;
  return withWorkspace(
    req,
    async (ws) => ({
      contact: await updateContact(ws.db, { userId: ws.userId, workspaceId: ws.workspaceId }, id, cid, await readJson(req)),
    }),
    { roles: [...editors] },
  );
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string; cid: string }> }) {
  const { id, cid } = await ctx.params;
  return withWorkspace(
    req,
    (ws) => deleteContact(ws.db, { userId: ws.userId, workspaceId: ws.workspaceId }, id, cid),
    { roles: [...editors] },
  );
}
