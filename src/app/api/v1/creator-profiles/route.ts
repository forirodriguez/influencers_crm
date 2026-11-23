import { listCreatorProfiles } from "../../../../modules/media-kit/queries";
import { createCreatorProfile } from "../../../../modules/media-kit/service";
import { withWorkspace } from "../../../../server/http";

export async function GET(req: Request) {
  return withWorkspace(req, async ({ db, workspaceId }) => ({ profiles: await listCreatorProfiles(db, workspaceId) }));
}

export async function POST(req: Request) {
  return withWorkspace(
    req,
    async ({ db, workspaceId }) => {
      const body = (await req.json()) as { displayName?: string; country?: string | null };
      const id = await createCreatorProfile(db, {
        workspaceId,
        displayName: body.displayName ?? "",
        country: body.country ?? null,
      });
      return { id };
    },
    { roles: ["owner", "manager"] },
  );
}
