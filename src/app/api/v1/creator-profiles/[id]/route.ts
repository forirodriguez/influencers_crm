import type { MediaKitSettings } from "../../../../../modules/media-kit/schema";
import { updateCreatorProfile, type ProfileInput } from "../../../../../modules/media-kit/service";
import { withWorkspace } from "../../../../../server/http";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  return withWorkspace(
    req,
    async ({ db, workspaceId }) => {
      const body = (await req.json()) as Partial<ProfileInput>;
      await updateCreatorProfile(db, {
        workspaceId,
        profileId: id,
        patch: {
          displayName: body.displayName ?? "",
          slug: body.slug ?? "",
          bio: body.bio ?? null,
          photoUrl: body.photoUrl ?? null,
          country: body.country ?? null,
          city: body.city ?? null,
          niches: Array.isArray(body.niches) ? body.niches : [],
          languages: Array.isArray(body.languages) ? body.languages : [],
          publicEmail: body.publicEmail ?? null,
          publicWhatsapp: body.publicWhatsapp ?? null,
          settings: (body.settings ?? {}) as MediaKitSettings,
        },
      });
      return { ok: true };
    },
    { roles: ["owner", "manager"] },
  );
}
