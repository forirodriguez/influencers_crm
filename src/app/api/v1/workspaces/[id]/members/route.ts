import { listMembers } from "../../../../../../modules/identity/queries";
import { notImplemented, withWorkspace } from "../../../../../../server/http";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const url = new URL(req.url);
  url.searchParams.set("workspace", id);
  const headers = new Headers(req.headers);
  headers.set("x-workspace-id", id);
  const scoped = new Request(req.url, { method: "GET", headers });
  return withWorkspace(scoped, async ({ db, workspaceId }) => ({ members: await listMembers(db, workspaceId) }));
}

export async function POST(req: Request) {
  return withWorkspace(req, async () => notImplemented("identity"));
}
