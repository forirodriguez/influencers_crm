import { hardDeleteAccounts, dispatchRemindersJob, markOverdue, scheduleReminders, weeklyDigest } from "./product";
import { refreshTokens, socialSyncDaily } from "./stubs";

export const functions = [
  scheduleReminders,
  dispatchRemindersJob,
  markOverdue,
  weeklyDigest,
  socialSyncDaily,
  refreshTokens,
  hardDeleteAccounts,
];
