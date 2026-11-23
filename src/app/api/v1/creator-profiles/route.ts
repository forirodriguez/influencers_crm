import { listCreatorProfiles } from "../../../../modules/media-kit/queries";
import { notImplemented, withWorkspace } from "../../../../server/http";

export async function GET(req: Request) {
  return withWorkspace(req, async ({ db, workspaceId }) => ({ profiles: await listCreatorProfiles(db, workspaceId) }));
}

export async function POST(req: Request) {
  return withWorkspace(req, async () => notImplemented("media-kit"));
}
