import { eq } from "drizzle-orm";
import { zonedDateISO } from "../../../../lib/dates";
import { listDeals, listStages } from "../../../../modules/crm/queries";
import { createDeal } from "../../../../modules/crm/service";
import { readJson } from "../../../../modules/crm/validation";
import { users } from "../../../../modules/identity/schema";
import { withWorkspace } from "../../../../server/http";

const editors = ["owner", "manager"] as const;

export async function GET(req: Request) {
  return withWorkspace(req, async ({ db, workspaceId, userId }) => {
    const [user] = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, userId)).limit(1);
    const url = new URL(req.url);
    const pick = (key: string) => url.searchParams.get(key) || undefined;
    const [deals, stages] = await Promise.all([
      listDeals(db, workspaceId, {
        todayISO: zonedDateISO(new Date(), user?.timezone ?? "UTC"),
        stageId: pick("stage"),
        brandId: pick("brand"),
        profileId: pick("profile"),
        from: pick("from"),
        to: pick("to"),
        paymentStatus: pick("paymentStatus"),
      }),
      listStages(db, workspaceId),
    ]);
    return { deals, stages };
  });
}

export async function POST(req: Request) {
  return withWorkspace(
    req,
    async (ctx) => createDeal(ctx.db, { userId: ctx.userId, workspaceId: ctx.workspaceId }, await readJson(req)),
    { roles: [...editors] },
  );
}
