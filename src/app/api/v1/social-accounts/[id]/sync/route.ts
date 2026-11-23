import { manualSync } from "../../../../../../modules/media-kit/sync";
import { withWorkspace } from "../../../../../../server/http";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  return withWorkspace(
    req,
    async ({ userId, workspaceId }) => {
      await manualSync({ userId, workspaceId, accountId: id });
      return { ok: true };
    },
    { roles: ["owner", "manager"] },
  );
}
