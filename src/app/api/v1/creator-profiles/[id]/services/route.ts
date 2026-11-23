import { saveService } from "../../../../../../modules/media-kit/service";
import { withWorkspace } from "../../../../../../server/http";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
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
      const serviceId = await saveService(db, {
        workspaceId,
        profileId: id,
        name: body.name ?? "",
        platform: body.platform ?? null,
        price: body.price ?? null,
        currency: body.currency ?? null,
        isFromPrice: body.isFromPrice === true,
        visible: body.visible !== false,
      });
      return { id: serviceId };
    },
    { roles: ["owner", "manager"] },
  );
}
