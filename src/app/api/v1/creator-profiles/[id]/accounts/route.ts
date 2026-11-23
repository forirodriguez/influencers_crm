import { addManualAccount } from "../../../../../../modules/media-kit/service";
import { withWorkspace } from "../../../../../../server/http";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  return withWorkspace(
    req,
    async ({ db, workspaceId }) => {
      const body = (await req.json()) as {
        platform?: string;
        handle?: string;
        followers?: number | null;
        following?: number | null;
        mediaCount?: number | null;
        likesTotal?: string | null;
      };
      const accountId = await addManualAccount(db, {
        workspaceId,
        profileId: id,
        platform: body.platform ?? "",
        handle: body.handle ?? "",
        followers: body.followers ?? null,
        following: body.following ?? null,
        mediaCount: body.mediaCount ?? null,
        likesTotal: body.likesTotal ?? null,
      });
      return { id: accountId };
    },
    { roles: ["owner", "manager"] },
  );
}
