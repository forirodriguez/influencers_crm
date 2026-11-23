import { createContact, listBrandContacts } from "../../../../../../modules/crm/service";
import { readJson } from "../../../../../../modules/crm/validation";
import { withWorkspace } from "../../../../../../server/http";

const editors = ["owner", "manager"] as const;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withWorkspace(req, async (ws) => ({
    contacts: await listBrandContacts(ws.db, { userId: ws.userId, workspaceId: ws.workspaceId }, id),
  }));
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withWorkspace(
    req,
    async (ws) => ({
      contact: await createContact(ws.db, { userId: ws.userId, workspaceId: ws.workspaceId }, id, await readJson(req)),
    }),
    { roles: [...editors] },
  );
}
