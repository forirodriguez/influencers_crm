import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { withUser } from "../../db/client";
import { verifySessionToken } from "../../lib/session";
import { activeWhatsappConsent } from "../reminders/queries";
import { listMemberships } from "./queries";
import { users } from "./schema";

export async function getAppContext() {
  const jar = await cookies();
  const session = await verifySessionToken(jar.get("icrm_session")?.value);
  if (!session) return null;
  return withUser(session.sub, async (db) => {
    const [user] = await db.select().from(users).where(eq(users.id, session.sub)).limit(1);
    if (!user || user.deletedAt) return null;
    const memberships = await listMemberships(db, user.id);
    const requested = jar.get("icrm_workspace")?.value;
    const workspace = memberships.find((item) => item.workspaceId === requested) ?? memberships[0];
    if (!workspace) return null;
    const consent = await activeWhatsappConsent(db, user.id);
    return {
      user,
      memberships,
      workspace,
      whatsappOptIn: Boolean(consent),
    };
  });
}

export async function requireAppContext() {
  const context = await getAppContext();
  if (!context) redirect("/login");
  return context;
}
