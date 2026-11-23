import { getTranslations } from "next-intl/server";
import { withUser } from "../../../db/client";
import { formatDateTime } from "../../../lib/dates";
import { offsetLabel } from "../../../lib/labels";
import { listMembers } from "../../../modules/identity/queries";
import { requireAppContext } from "../../../modules/identity/context";
import { listNotifications, listReminderRules } from "../../../modules/reminders/queries";
import { LocaleForm } from "./locale-form";
import { PrivacyPanel } from "./privacy-panel";
import { RemindersPanel } from "./reminders-panel";

export default async function SettingsPage() {
  const t = await getTranslations();
  const labels = (await getTranslations("labels")) as (key: string) => string;
  const context = await requireAppContext();
  const data = await withUser(context.user.id, async (db) => ({
    members: await listMembers(db, context.workspace.workspaceId),
    rules: await listReminderRules(db, context.workspace.workspaceId),
    notifications: await listNotifications(db, context.workspace.workspaceId, context.user.id),
  }));
  const roleLabel = {
    owner: t("settings.roleOwner"),
    manager: t("settings.roleManager"),
    viewer: t("settings.roleViewer"),
  };
  const offset = { day: labels("offsetDay"), before48: labels("offset48h"), after7: labels("offset7d") };
  return (
    <div className="space-y-8">
      <h1 className="font-display text-4xl">{t("settings.title")}</h1>
      <section className="rounded-2xl border border-line bg-card p-4">
        <h2 className="font-display text-2xl">{t("settings.account")}</h2>
        <p className="mt-2 text-sm">{context.user.email}</p>
        <p className="text-sm text-muted">{context.user.country} · {context.user.timezone}</p>
        <LocaleForm label={t("settings.locale")} current={context.user.locale} save={t("common.save")} />
      </section>
      <RemindersPanel
        workspaceId={context.workspace.workspaceId}
        canEdit={context.workspace.role !== "viewer"}
        optedIn={context.whatsappOptIn}
        phone={context.user.phoneE164}
        emailReminders={context.user.emailReminders}
        dailySummary={context.user.dailySummary}
        rules={data.rules.map((rule) => ({
          id: rule.id,
          enabled: rule.enabled,
          label: `${labels(rule.entity)} · ${offsetLabel(rule.offsetMinutes, offset)} · ${labels(rule.channel)}`,
        }))}
        notes={data.notifications.map((note) => {
          const payload = note.payload as { title?: string };
          return {
            id: note.id,
            title: payload.title || note.template,
            meta: `${labels(note.channel)} · ${formatDateTime(note.createdAt, context.user.locale, context.user.timezone)}`,
          };
        })}
        copy={{
          phone: t("reminders.phone"),
          phoneHelp: t("reminders.phoneHelp"),
          consent: t("reminders.consent"),
          sendCode: t("reminders.sendCode"),
          code: t("reminders.code"),
          confirmCode: t("reminders.confirmCode"),
          revoke: t("reminders.revoke"),
          activePhone: t("reminders.activePhone"),
          whatsappOn: t("reminders.whatsappOn"),
          whatsappOff: t("reminders.whatsappOff"),
          quiet: t("reminders.quiet"),
          preferences: t("reminders.preferences"),
          emailToggle: t("reminders.emailToggle"),
          digestToggle: t("reminders.digestToggle"),
          rules: t("reminders.rules"),
          rulesHelp: t("reminders.rulesHelp"),
          saved: t("reminders.saved"),
          notifications: t("reminders.notifications"),
          emptyNotes: t("reminders.emptyNotes"),
          devCode: t("reminders.devCode"),
        }}
      />
      <section>
        <h2 className="font-display text-2xl">{t("settings.members")}</h2>
        <p className="mt-2 text-sm text-muted">{t("settings.inviteHint")}</p>
        <ul className="mt-3 space-y-2 text-sm">
          {data.members.map((member) => (
            <li key={member.userId} className="rounded-xl border border-line bg-card px-3 py-2">
              {member.name ?? member.email} · {roleLabel[member.role]}
            </li>
          ))}
        </ul>
      </section>
      <PrivacyPanel
        copy={{
          exportTitle: t("settings.export"),
          exportHelp: t("settings.exportHelp"),
          exportJson: t("settings.exportJson"),
          exportCsv: t("settings.exportCsv"),
          deleteTitle: t("settings.delete"),
          deleteHelp: t("settings.deleteHelp"),
          deleteConfirm: t("settings.deleteConfirm"),
          deleteButton: t("settings.deleteButton"),
        }}
      />
    </div>
  );
}
