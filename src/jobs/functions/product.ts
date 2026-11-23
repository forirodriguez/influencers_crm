import { hardDeleteExpiredAccounts } from "../../modules/identity/privacy";
import { dispatchReminders, markPaymentsOverdue, purgeExpiredWhatsappMessages, sendDigests } from "../../modules/reminders/engine";
import { inngest } from "../client";

export const scheduleReminders = inngest.createFunction(
  { id: "reminders.schedule", name: "reminders.schedule", triggers: { event: "reminders/schedule" } },
  async ({ event }) => {
    const data = (event?.data ?? {}) as { workspaceId?: string };
    const result = await dispatchReminders(new Date(), data.workspaceId);
    return { implemented: true as const, id: "reminders.schedule", ...result };
  },
);

export const dispatchRemindersJob = inngest.createFunction(
  { id: "reminders.dispatch", name: "reminders.dispatch", triggers: { cron: "*/15 * * * *" } },
  async () => {
    const result = await dispatchReminders(new Date());
    return { implemented: true as const, id: "reminders.dispatch", ...result };
  },
);

export const markOverdue = inngest.createFunction(
  { id: "payments.mark-overdue", name: "payments.mark-overdue", triggers: { cron: "15 6 * * *" } },
  async () => {
    const overdue = await markPaymentsOverdue(new Date());
    return { implemented: true as const, id: "payments.mark-overdue", overdue };
  },
);

export const weeklyDigest = inngest.createFunction(
  {
    id: "digest.weekly",
    name: "digest.weekly",
    triggers: { cron: "0 * * * *" },
  },
  async () => {
    const created = await sendDigests(new Date());
    return { implemented: true as const, id: "digest.weekly", created };
  },
);

export const hardDeleteAccounts = inngest.createFunction(
  { id: "account.hard-delete", name: "account.hard-delete", triggers: { cron: "45 4 * * *" } },
  async () => {
    const deleted = await hardDeleteExpiredAccounts(new Date());
    const messages = await purgeExpiredWhatsappMessages(new Date());
    return { implemented: true as const, id: "account.hard-delete", ...deleted, messages };
  },
);
