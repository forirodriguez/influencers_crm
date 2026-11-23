import { paymentSummary } from "../../../../../modules/crm/queries";
import { zonedDateISO } from "../../../../../lib/dates";
import { withWorkspace } from "../../../../../server/http";
import { eq } from "drizzle-orm";
import { users } from "../../../../../modules/identity/schema";

export async function GET(req: Request) {
  return withWorkspace(req, async ({ db, workspaceId, userId }) => {
    const [user] = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, userId)).limit(1);
    return { summary: await paymentSummary(db, workspaceId, zonedDateISO(new Date(), user?.timezone ?? "UTC")) };
  });
}
