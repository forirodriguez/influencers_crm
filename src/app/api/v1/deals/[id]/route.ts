import { eq } from "drizzle-orm";
import { zonedDateISO } from "../../../../../lib/dates";
import { ApiError } from "../../../../../lib/errors";
import { findExclusivityClash, getDeal, listActivities, listDeliverables, listPaymentExpectations } from "../../../../../modules/crm/queries";
import { deleteDeal, updateDeal } from "../../../../../modules/crm/service";
import { readJson } from "../../../../../modules/crm/validation";
import { users } from "../../../../../modules/identity/schema";
import { withWorkspace } from "../../../../../server/http";

const editors = ["owner", "manager"] as const;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withWorkspace(req, async ({ db, workspaceId, userId }) => {
    const [user] = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, userId)).limit(1);
    const todayISO = zonedDateISO(new Date(), user?.timezone ?? "UTC");
    const deal = await getDeal(db, workspaceId, id);
    if (!deal) throw new ApiError("not_found", "No encontramos ese acuerdo", 404);
    const [deliverables, payments, activities, exclusivityWarning] = await Promise.all([
      listDeliverables(db, workspaceId, { dealId: id }),
      listPaymentExpectations(db, workspaceId, { dealId: id }),
      listActivities(db, workspaceId, id),
      findExclusivityClash(db, workspaceId, {
        brandId: deal.brandId,
        category: deal.exclusivityCategory,
        dealId: id,
        todayISO,
      }),
    ]);
    return { deal, deliverables, payments, activities, exclusivityWarning };
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withWorkspace(
    req,
    async (ws) => updateDeal(ws.db, { userId: ws.userId, workspaceId: ws.workspaceId }, id, await readJson(req)),
    { roles: [...editors] },
  );
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withWorkspace(
    req,
    (ws) => deleteDeal(ws.db, { userId: ws.userId, workspaceId: ws.workspaceId }, id),
    { roles: [...editors] },
  );
}
