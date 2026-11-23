import { listMutes, updateReminderSettings } from "../../../../modules/reminders/preferences";
import { listReminderRules } from "../../../../modules/reminders/queries";
import { withWorkspace } from "../../../../server/http";

export async function GET(req: Request) {
  return withWorkspace(req, async ({ db, workspaceId, userId }) => ({
    rules: await listReminderRules(db, workspaceId),
    mutes: await listMutes(db, workspaceId, userId),
  }));
}

export async function PATCH(req: Request) {
  return withWorkspace(req, async ({ db, workspaceId, userId, role }) => {
    const body = (await req.json()) as {
      rules?: { id: string; enabled: boolean }[];
      mute?: { dealId: string; muted: boolean };
    };
    await updateReminderSettings(db, { workspaceId, userId, role, rules: body.rules, mute: body.mute });
    return { ok: true };
  });
}
