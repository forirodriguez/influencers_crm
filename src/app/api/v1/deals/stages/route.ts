import { listStages } from "../../../../../modules/crm/queries";
import { createStage, reorderStages } from "../../../../../modules/crm/service";
import { readJson } from "../../../../../modules/crm/validation";
import { withWorkspace } from "../../../../../server/http";

const editors = ["owner", "manager"] as const;

export async function GET(req: Request) {
  return withWorkspace(req, async ({ db, workspaceId }) => ({ stages: await listStages(db, workspaceId) }));
}

export async function POST(req: Request) {
  return withWorkspace(
    req,
    async (ctx) => ({ stage: await createStage(ctx.db, { userId: ctx.userId, workspaceId: ctx.workspaceId }, await readJson(req)) }),
    { roles: [...editors] },
  );
}

export async function PATCH(req: Request) {
  return withWorkspace(
    req,
    async (ctx) => ({ stages: await reorderStages(ctx.db, { userId: ctx.userId, workspaceId: ctx.workspaceId }, await readJson(req)) }),
    { roles: [...editors] },
  );
}
