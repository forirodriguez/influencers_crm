import { listBrands } from "../../../../modules/crm/queries";
import { createBrand } from "../../../../modules/crm/service";
import { readJson } from "../../../../modules/crm/validation";
import { withWorkspace } from "../../../../server/http";

const editors = ["owner", "manager"] as const;

export async function GET(req: Request) {
  return withWorkspace(req, async ({ db, workspaceId }) => {
    const query = new URL(req.url).searchParams.get("q") ?? undefined;
    return { brands: await listBrands(db, workspaceId, query) };
  });
}

export async function POST(req: Request) {
  return withWorkspace(
    req,
    async (ctx) => ({ brand: await createBrand(ctx.db, { userId: ctx.userId, workspaceId: ctx.workspaceId }, await readJson(req)) }),
    { roles: [...editors] },
  );
}
