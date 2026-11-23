import { listReminderRules } from "../../../../modules/reminders/queries";
import { notImplemented, withWorkspace } from "../../../../server/http";

export async function GET(req: Request) {
  return withWorkspace(req, async ({ db, workspaceId }) => ({ rules: await listReminderRules(db, workspaceId) }));
}

export async function PATCH(req: Request) {
  return withWorkspace(req, async () => notImplemented("reminders"));
}
