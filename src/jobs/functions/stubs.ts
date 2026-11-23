import { inngest } from "../client";

function cronJob(id: string, cron: string) {
  return inngest.createFunction({ id, name: id, triggers: { cron } }, async () => ({
    implemented: false as const,
    id,
  }));
}

export const socialSyncDaily = cronJob("social.sync-daily", "0 7 * * *");
export const refreshTokens = cronJob("social.refresh-tokens", "30 5 * * *");
