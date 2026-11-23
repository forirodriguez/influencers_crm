import { and, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "../../db/types";
import { notifications, reminderRules, whatsappConsents } from "./schema";

export async function listReminderRules(db: Db, workspaceId: string) {
  return db
    .select()
    .from(reminderRules)
    .where(and(eq(reminderRules.workspaceId, workspaceId), isNull(reminderRules.deletedAt)))
    .orderBy(reminderRules.entity);
}

export async function listNotifications(db: Db, workspaceId: string, userId: string) {
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.workspaceId, workspaceId), eq(notifications.userId, userId), isNull(notifications.deletedAt)))
    .orderBy(desc(notifications.createdAt))
    .limit(20);
}

export async function activeWhatsappConsent(db: Db, userId: string) {
  const rows = await db
    .select()
    .from(whatsappConsents)
    .where(and(eq(whatsappConsents.userId, userId), isNull(whatsappConsents.deletedAt), isNull(whatsappConsents.revokedAt)))
    .limit(1);
  return rows[0] ?? null;
}
