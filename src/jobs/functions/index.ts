import { hardDeleteAccounts, dispatchRemindersJob, markOverdue, scheduleReminders, weeklyDigest } from "./product";
import { refreshTokens, socialSyncDaily } from "./social";

export const functions = [
  scheduleReminders,
  dispatchRemindersJob,
  markOverdue,
  weeklyDigest,
  socialSyncDaily,
  refreshTokens,
  hardDeleteAccounts,
];
