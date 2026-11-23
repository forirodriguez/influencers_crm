import { eq } from "drizzle-orm";
import type { Db } from "../../../../../db/types";
import { zonedDateISO } from "../../../../../lib/dates";
import { ApiError } from "../../../../../lib/errors";
import { brandPaceDays, getBrand, listDeals } from "../../../../../modules/crm/queries";
import { deleteBrand, listBrandContacts, updateBrand } from "../../../../../modules/crm/service";
import { readJson } from "../../../../../modules/crm/validation";
import { users } from "../../../../../modules/identity/schema";
import { withWorkspace } from "../../../../../server/http";

const editors = ["owner", "manager"] as const;

async function todayISO(db: Db, userId: string) {
  const [user] = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, userId)).limit(1);
  return zonedDateISO(new Date(), user?.timezone ?? "UTC");
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withWorkspace(req, async ({ db, workspaceId, userId }) => {
    const brand = await getBrand(db, workspaceId, id);
    if (!brand) throw new ApiError("not_found", "No encontramos esa marca", 404);
    const today = await todayISO(db, userId);
    const [contacts, deals, paceDays] = await Promise.all([
      listBrandContacts(db, { userId, workspaceId }, id),
      listDeals(db, workspaceId, { brandId: id, todayISO: today }),
      brandPaceDays(db, workspaceId, id),
    ]);
    return { brand, contacts, deals, paceDays };
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withWorkspace(
    req,
    async (ws) => ({ brand: await updateBrand(ws.db, { userId: ws.userId, workspaceId: ws.workspaceId }, id, await readJson(req)) }),
    { roles: [...editors] },
  );
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withWorkspace(
    req,
    async (ws) => deleteBrand(ws.db, { userId: ws.userId, workspaceId: ws.workspaceId }, id),
    { roles: [...editors] },
  );
}
