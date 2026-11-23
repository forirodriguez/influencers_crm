import { refreshExpiringTokens, syncDueAccounts } from "../../modules/media-kit/sync";
import { inngest } from "../client";

function cronJob(id: string, cron: string, run?: () => Promise<unknown>) {
  return inngest.createFunction({ id, name: id, triggers: { cron } }, async () => {
    if (run) return run();
    return { implemented: false as const, id };
  });
}

function eventJob(id: string, event: string) {
  return inngest.createFunction({ id, name: id, triggers: { event } }, async () => ({
    implemented: false as const,
    id,
  }));
}

export const scheduleReminders = eventJob("reminders.schedule", "reminders/schedule");
export const dispatchReminders = cronJob("reminders.dispatch", "*/15 * * * *");
export const markOverdue = cronJob("payments.mark-overdue", "15 6 * * *");
export const weeklyDigest = cronJob("digest.weekly", "0 * * * 1");
export const socialSyncDaily = cronJob("social.sync-daily", "0 7 * * *", () => syncDueAccounts(new Date()));
export const refreshTokens = cronJob("social.refresh-tokens", "30 5 * * *", () => refreshExpiringTokens(new Date()));
export const hardDeleteAccounts = cronJob("account.hard-delete", "45 4 * * *");

export const functions = [
  scheduleReminders,
  dispatchReminders,
  markOverdue,
  weeklyDigest,
  socialSyncDaily,
  refreshTokens,
  hardDeleteAccounts,
];
