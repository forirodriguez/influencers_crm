import { getTranslations } from "next-intl/server";
import { withUser } from "../../../db/client";
import { addDays, formatCalendarDate, formatDateTime, zonedDateISO } from "../../../lib/dates";
import { formatMoney } from "../../../lib/money";
import { listPaymentExpectations, listStaleDeals, listUpcomingDeliverables } from "../../../modules/crm/queries";
import { displayPaymentStatus } from "../../../modules/crm/status";
import { requireAppContext } from "../../../modules/identity/context";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("today") };
}

export default async function TodayPage() {
  const t = await getTranslations();
  const labels = (await getTranslations("labels")) as (key: string) => string;
  const context = await requireAppContext();
  const today = zonedDateISO(new Date(), context.user.timezone);
  const data = await withUser(context.user.id, async (db) => {
    const [deliverables, payments, stale] = await Promise.all([
      listUpcomingDeliverables(db, context.workspace.workspaceId, addDays(new Date(), 7)),
      listPaymentExpectations(db, context.workspace.workspaceId),
      listStaleDeals(db, context.workspace.workspaceId, addDays(new Date(), -14)),
    ]);
    return { deliverables, payments, stale };
  });
  const overdue = data.payments.filter((row) => displayPaymentStatus(row.status, row.dueDate, today) === "overdue");
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl">{t("hoy.hello", { name: context.user.name ?? "" })}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">{t("hoy.hint")}</p>
      </div>
      <section>
        <h2 className="font-display text-2xl">{t("hoy.week")}</h2>
        {data.deliverables.length === 0 ? <p className="mt-2 text-sm text-muted">{t("hoy.emptyWeek")}</p> : (
          <ul className="mt-3 space-y-2">
            {data.deliverables.map((item) => (
              <li key={item.id} className="rounded-2xl border border-line bg-card px-4 py-3">
                <p className="font-medium">{item.dealTitle}</p>
                <p className="text-sm text-muted">
                  {item.brandName} · {labels(item.format)} · {item.publishDueAt ? formatDateTime(item.publishDueAt, context.user.locale, context.user.timezone) : t("crm.noDate")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="font-display text-2xl">{t("hoy.overdue")}</h2>
        {overdue.length === 0 ? <p className="mt-2 text-sm text-muted">{t("hoy.emptyOverdue")}</p> : (
          <ul className="mt-3 space-y-2">
            {overdue.map((item) => (
              <li key={item.id} className="rounded-2xl border border-line bg-card px-4 py-3">
                <p className="font-medium">{item.brandName}</p>
                <p className="text-sm text-muted">
                  {formatMoney(item.amountMinor, item.currency, context.user.locale)} · {formatCalendarDate(item.dueDate, context.user.locale)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="font-display text-2xl">{t("hoy.stale")}</h2>
        {data.stale.length === 0 ? <p className="mt-2 text-sm text-muted">{t("hoy.emptyStale")}</p> : (
          <ul className="mt-3 space-y-2">
            {data.stale.map((item) => (
              <li key={item.id} className="rounded-2xl border border-line bg-card px-4 py-3 text-sm">
                {item.brandName} · {item.title} · {item.stageName}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
