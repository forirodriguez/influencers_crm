import { getTranslations } from "next-intl/server";
import { withUser } from "../../../db/client";
import { listMembers } from "../../../modules/identity/queries";
import { requireAppContext } from "../../../modules/identity/context";
import { offsetLabel } from "../../../lib/labels";
import { listReminderRules } from "../../../modules/reminders/queries";
import { LocaleForm } from "./locale-form";

export default async function SettingsPage() {
  const t = await getTranslations();
  const labels = (await getTranslations("labels")) as (key: string) => string;
  const context = await requireAppContext();
  const data = await withUser(context.user.id, async (db) => ({
    members: await listMembers(db, context.workspace.workspaceId),
    rules: await listReminderRules(db, context.workspace.workspaceId),
  }));
  const roleLabel = {
    owner: t("settings.roleOwner"),
    manager: t("settings.roleManager"),
    viewer: t("settings.roleViewer"),
  };
  return (
    <div className="space-y-8">
      <h1 className="font-display text-4xl">{t("settings.title")}</h1>
      <section className="rounded-2xl border border-line bg-card p-4">
        <h2 className="font-display text-2xl">{t("settings.account")}</h2>
        <p className="mt-2 text-sm">{context.user.email}</p>
        <p className="text-sm text-muted">{context.user.country} · {context.user.timezone}</p>
        <LocaleForm label={t("settings.locale")} current={context.user.locale} save={t("common.save")} />
      </section>
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
      <section>
        <h2 className="font-display text-2xl">{t("reminders.rules")}</h2>
        <p className="mt-2 text-sm">{context.whatsappOptIn ? t("reminders.whatsappOn") : t("reminders.whatsappOff")}</p>
        <p className="text-sm text-muted">{t("reminders.quiet")}</p>
        <p className="mt-2 text-sm text-muted">{t("reminders.stub")}</p>
        <ul className="mt-3 space-y-2 text-sm">
          {data.rules.map((rule) => (
            <li key={rule.id} className="rounded-xl bg-sand px-3 py-2">
              {labels(rule.entity)} · {offsetLabel(rule.offsetMinutes, { day: labels("offsetDay"), before48: labels("offset48h"), after7: labels("offset7d") })} · {labels(rule.channel)} · {labels(rule.enabled ? "on" : "off")}
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-2xl border border-dashed border-line p-4">
        <h2 className="font-display text-2xl">{t("settings.export")}</h2>
        <p className="mt-2 text-sm text-muted">{t("settings.soon")}</p>
        <button type="button" disabled className="mt-3 rounded-full border border-line px-4 py-2 text-sm opacity-60">
          {t("settings.export")}
        </button>
        <button type="button" disabled className="ml-2 mt-3 rounded-full border border-line px-4 py-2 text-sm opacity-60">
          {t("settings.delete")}
        </button>
      </section>
    </div>
  );
}
