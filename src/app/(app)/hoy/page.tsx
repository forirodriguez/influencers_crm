import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { withUser } from "../../../db/client";
import { addDays, addDaysISO, formatCalendarDate, formatDateTime, zonedDateISO } from "../../../lib/dates";
import { formatMoney } from "../../../lib/money";
import { deliverableAnchor } from "../../../modules/crm/agenda";
import { FollowUp } from "../../../modules/crm/ui/follow-up";
import { listDeliverablesInWindow, listPaymentExpectations, listStaleDeals } from "../../../modules/crm/queries";
import { persistOverdue } from "../../../modules/crm/service";
import { displayPaymentStatus, outstandingMinor } from "../../../modules/crm/status";
import { requireAppContext } from "../../../modules/identity/context";
import { listNotifications } from "../../../modules/reminders/queries";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("today") };
}

export default async function TodayPage() {
  const t = await getTranslations();
  const crm = await getTranslations("crm");
  const labels = (await getTranslations("labels")) as (key: string) => string;
  const context = await requireAppContext();
  const canEdit = context.workspace.role !== "viewer";
  const today = zonedDateISO(new Date(), context.user.timezone);
  const data = await withUser(context.user.id, async (db) => {
    if (canEdit) await persistOverdue(db, context.workspace.workspaceId, today);
    const [deliverables, payments, stale, notifications] = await Promise.all([
      listDeliverablesInWindow(db, context.workspace.workspaceId, context.user.timezone, today, addDaysISO(today, 6)),
      listPaymentExpectations(db, context.workspace.workspaceId),
      listStaleDeals(db, context.workspace.workspaceId, addDays(new Date(), -14)),
      listNotifications(db, context.workspace.workspaceId, context.user.id),
    ]);
    return { deliverables, payments, stale, notifications: notifications.filter((note) => note.channel === "in_app") };
  });
  const overdue = data.payments.filter((row) => displayPaymentStatus(row.status, row.dueDate, today) === "overdue");
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">{t("hoy.hello", { name: context.user.name ?? "" })}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">{crm("hoyIntro")}</p>
        </div>
        {canEdit ? (
          <Link href="/acuerdos/nuevo" className="inline-flex min-h-11 items-center rounded-full bg-clay px-4 py-2 text-sm font-medium text-white">
            {crm("newDeal")}
          </Link>
        ) : null}
      </div>
      {!canEdit ? <p className="text-sm text-muted">{crm("readOnly")}</p> : null}
      <section>
        <h2 className="font-display text-2xl">{t("hoy.week")}</h2>
        {data.deliverables.length === 0 ? <p className="mt-2 text-sm text-muted">{t("hoy.emptyWeek")}</p> : (
          <ul className="mt-3 space-y-2">
            {data.deliverables.map((item) => (
              <li key={item.id}>
                <Link href={`/acuerdos/${item.dealId}`} className="block rounded-2xl border border-line bg-card px-4 py-3">
                  <p className="font-medium">{item.dealTitle}</p>
                  <p className="text-sm text-muted">
                    {item.brandName} · {labels(item.format)} · {formatDateTime(deliverableAnchor(item), context.user.locale, context.user.timezone)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="font-display text-2xl">{t("hoy.overdue")}</h2>
        {overdue.length === 0 ? <p className="mt-2 text-sm text-muted">{t("hoy.emptyOverdue")}</p> : (
          <ul className="mt-3 space-y-3">
            {overdue.map((item) => {
              const outstanding = outstandingMinor(item.amountMinor, item.receivedMinor);
              const amount = formatMoney(outstanding > 0n ? outstanding : item.amountMinor, item.currency, context.user.locale);
              return (
                <li key={item.id} className="space-y-3 rounded-2xl border border-line bg-card px-4 py-3">
                  <Link href={`/acuerdos/${item.dealId}`}>
                    <p className="font-medium">{item.brandName}</p>
                    <p className="text-sm text-muted">{item.dealTitle} · {amount} · {formatCalendarDate(item.dueDate, context.user.locale)}</p>
                  </Link>
                  <FollowUp
                    text={crm("followUpText", {
                      who: item.contactName || item.brandName,
                      title: item.dealTitle,
                      amount,
                      due: formatCalendarDate(item.dueDate, context.user.locale),
                      creator: context.user.name ?? "",
                    })}
                    subject={crm("followUpSubject", { brand: item.brandName })}
                    phone={item.contactWhatsapp}
                    email={item.contactEmail}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section>
        <h2 className="font-display text-2xl">{t("reminders.notifications")}</h2>
        {data.notifications.length === 0 ? <p className="mt-2 text-sm text-muted">{t("reminders.emptyNotes")}</p> : (
          <ul className="mt-3 space-y-2">
            {data.notifications.map((note) => {
              const payload = note.payload as { title?: string; body?: string; url?: string };
              const href = payload.url && (payload.url.startsWith("/") || payload.url.startsWith("http")) ? payload.url : null;
              const body = (
                <>
                  <p className="font-medium">{payload.title || note.template}</p>
                  {payload.body ? <p className="text-sm text-muted">{payload.body}</p> : null}
                </>
              );
              return (
                <li key={note.id} className="rounded-2xl border border-line bg-card px-4 py-3">
                  {href ? <a href={href} className="block">{body}</a> : body}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section>
        <h2 className="font-display text-2xl">{t("hoy.stale")}</h2>
        {data.stale.length === 0 ? <p className="mt-2 text-sm text-muted">{t("hoy.emptyStale")}</p> : (
          <ul className="mt-3 space-y-2">
            {data.stale.map((item) => (
              <li key={item.id}>
                <Link href={`/acuerdos/${item.id}`} className="block rounded-2xl border border-line bg-card px-4 py-3 text-sm">
                  {item.brandName} · {item.title} · {item.stageName}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
