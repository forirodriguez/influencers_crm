import { disconnectAccount, updateManualAccount } from "../../../../../modules/media-kit/service";
import { withWorkspace } from "../../../../../server/http";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  return withWorkspace(
    req,
    async ({ db, workspaceId }) => {
      const body = (await req.json()) as {
        followers?: number | null;
        following?: number | null;
        mediaCount?: number | null;
        likesTotal?: string | null;
      };
      await updateManualAccount(db, {
        workspaceId,
        accountId: id,
        followers: body.followers ?? null,
        following: body.following ?? null,
        mediaCount: body.mediaCount ?? null,
        likesTotal: body.likesTotal ?? null,
      });
      return { ok: true };
    },
    { roles: ["owner", "manager"] },
  );
}

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  return withWorkspace(
    req,
    async ({ db, workspaceId }) => {
      await disconnectAccount(db, { workspaceId, accountId: id });
      return { ok: true };
    },
    { roles: ["owner", "manager"] },
  );
}
