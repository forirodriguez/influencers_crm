import { eq } from "drizzle-orm";
import { zonedDateISO } from "../../../../../lib/dates";
import { paymentSummary } from "../../../../../modules/crm/queries";
import { persistOverdue } from "../../../../../modules/crm/service";
import { users } from "../../../../../modules/identity/schema";
import { withWorkspace } from "../../../../../server/http";

export async function GET(req: Request) {
  return withWorkspace(req, async ({ db, workspaceId, userId, role }) => {
    const [user] = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, userId)).limit(1);
    const timeZone = user?.timezone ?? "UTC";
    const today = zonedDateISO(new Date(), timeZone);
    if (role !== "viewer") await persistOverdue(db, workspaceId, today);
    return { summary: await paymentSummary(db, workspaceId, today, timeZone) };
  });
}
