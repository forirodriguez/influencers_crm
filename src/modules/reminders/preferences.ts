import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "../../db/types";
import { ApiError } from "../../lib/errors";
import { reminderMutes, reminderRules } from "./schema";

type WorkspaceRole = "owner" | "manager" | "viewer";

export async function updateReminderSettings(
  db: Db,
  input: {
    workspaceId: string;
    userId: string;
    role: WorkspaceRole;
    rules?: { id: string; enabled: boolean }[];
    mute?: { dealId: string; muted: boolean };
  },
): Promise<void> {
  if (input.role === "viewer") throw new ApiError("forbidden", "No tenés permiso para cambiar los recordatorios", 403);
  for (const rule of input.rules ?? []) {
    if (typeof rule.enabled !== "boolean" || typeof rule.id !== "string") {
      throw new ApiError("invalid_rule", "La regla no es válida", 400);
    }
    await db
      .update(reminderRules)
      .set({ enabled: rule.enabled })
      .where(and(eq(reminderRules.id, rule.id), eq(reminderRules.workspaceId, input.workspaceId), isNull(reminderRules.deletedAt)));
  }
  if (!input.mute) return;
  if (input.mute.muted) {
    await db
      .insert(reminderMutes)
      .values({ workspaceId: input.workspaceId, userId: input.userId, dealId: input.mute.dealId })
      .onConflictDoNothing();
    return;
  }
  await db
    .update(reminderMutes)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(reminderMutes.workspaceId, input.workspaceId),
        eq(reminderMutes.userId, input.userId),
        eq(reminderMutes.dealId, input.mute.dealId),
        isNull(reminderMutes.deletedAt),
      ),
    );
}

export async function listMutes(db: Db, workspaceId: string, userId: string) {
  return db
    .select({ dealId: reminderMutes.dealId })
    .from(reminderMutes)
    .where(and(eq(reminderMutes.workspaceId, workspaceId), eq(reminderMutes.userId, userId), isNull(reminderMutes.deletedAt)));
}
