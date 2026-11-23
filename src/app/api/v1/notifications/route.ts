import { listNotifications } from "../../../../modules/reminders/queries";
import { withWorkspace } from "../../../../server/http";

export async function GET(req: Request) {
  return withWorkspace(req, async ({ db, workspaceId, userId }) => ({
    notifications: await listNotifications(db, workspaceId, userId),
  }));
}
