import { eq } from "drizzle-orm";
import { addDaysISO, zonedDateISO } from "../../../../lib/dates";
import { listDeliverables, listDeliverablesInWindow } from "../../../../modules/crm/queries";
import { createDeliverable } from "../../../../modules/crm/service";
import { readJson } from "../../../../modules/crm/validation";
import { users } from "../../../../modules/identity/schema";
import { withWorkspace } from "../../../../server/http";

export async function GET(req: Request) {
  return withWorkspace(req, async ({ db, workspaceId, userId }) => {
    const dueWithin = new URL(req.url).searchParams.get("dueWithin");
    if (dueWithin) {
      const days = Number.parseInt(dueWithin, 10);
      const span = Number.isFinite(days) && days > 0 ? days : 7;
      const [account] = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, userId)).limit(1);
      const timeZone = account?.timezone || "UTC";
      const today = zonedDateISO(new Date(), timeZone);
      return {
        deliverables: await listDeliverablesInWindow(db, workspaceId, timeZone, today, addDaysISO(today, span - 1)),
      };
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
