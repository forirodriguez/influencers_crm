import { removeService, saveService } from "../../../../../../../modules/media-kit/service";
import { withWorkspace } from "../../../../../../../server/http";

type Params = { params: Promise<{ id: string; sid: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { id, sid } = await params;
  return withWorkspace(
    req,
    async ({ db, workspaceId }) => {
      const body = (await req.json()) as {
        name?: string;
        platform?: string | null;
        price?: string | null;
        currency?: string | null;
        isFromPrice?: boolean;
        visible?: boolean;
      };
      await saveService(db, {
        workspaceId,
        profileId: id,
        serviceId: sid,
        name: body.name ?? "",
        platform: body.platform ?? null,
        price: body.price ?? null,
        currency: body.currency ?? null,
        isFromPrice: body.isFromPrice === true,
        visible: body.visible !== false,
      });
      return { ok: true };
    },
    { roles: ["owner", "manager"] },
  );
}

export async function DELETE(req: Request, { params }: Params) {
  const { id, sid } = await params;
  return withWorkspace(
    req,
    async ({ db, workspaceId }) => {
      await removeService(db, { workspaceId, profileId: id, serviceId: sid });
      return { ok: true };
    },
    { roles: ["owner", "manager"] },
  );
}
