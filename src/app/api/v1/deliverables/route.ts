import { addDays } from "../../../../lib/dates";
import { listDeliverables, listUpcomingDeliverables } from "../../../../modules/crm/queries";
import { createDeliverable } from "../../../../modules/crm/service";
import { readJson } from "../../../../modules/crm/validation";
import { withWorkspace } from "../../../../server/http";

export async function GET(req: Request) {
  return withWorkspace(req, async ({ db, workspaceId }) => {
    const dueWithin = new URL(req.url).searchParams.get("dueWithin");
    if (dueWithin) {
      const days = Number.parseInt(dueWithin, 10);
      return { deliverables: await listUpcomingDeliverables(db, workspaceId, addDays(new Date(), Number.isFinite(days) ? days : 7)) };
    }
    return { deliverables: await listDeliverables(db, workspaceId) };
  });
}

export async function POST(req: Request) {
  return withWorkspace(
    req,
    async (ctx) => ({
      deliverable: await createDeliverable(ctx.db, { userId: ctx.userId, workspaceId: ctx.workspaceId }, await readJson(req)),
    }),
    { roles: ["owner", "manager"] },
  );
}
