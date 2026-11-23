import { listDeals } from "../../../../modules/crm/queries";
import { notImplemented, withWorkspace } from "../../../../server/http";

export async function GET(req: Request) {
  return withWorkspace(req, async ({ db, workspaceId }) => ({ deals: await listDeals(db, workspaceId) }));
}

export async function POST(req: Request) {
  return withWorkspace(req, async () => notImplemented("crm"));
}
