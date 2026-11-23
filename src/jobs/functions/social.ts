import { refreshExpiringTokens, syncDueAccounts } from "../../modules/media-kit/sync";
import { inngest } from "../client";

export const socialSyncDaily = inngest.createFunction(
  { id: "social.sync-daily", name: "social.sync-daily", triggers: { cron: "0 7 * * *" } },
  async () => {
    const result = await syncDueAccounts(new Date());
    return { implemented: true as const, id: "social.sync-daily", ...result };
  },
);

export const refreshTokens = inngest.createFunction(
  { id: "social.refresh-tokens", name: "social.refresh-tokens", triggers: { cron: "30 5 * * *" } },
  async () => {
    const result = await refreshExpiringTokens(new Date());
    return { implemented: true as const, id: "social.refresh-tokens", ...result };
  },
);
