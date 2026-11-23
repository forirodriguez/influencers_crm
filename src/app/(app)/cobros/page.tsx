import { getTranslations } from "next-intl/server";
import { eq } from "drizzle-orm";
import { withUser } from "../../../db/client";
import { zonedDateISO, formatCalendarDate } from "../../../lib/dates";
import { formatMoney } from "../../../lib/money";
import { listPaymentExpectations, paymentSummary } from "../../../modules/crm/queries";
import { displayPaymentStatus } from "../../../modules/crm/status";
import { requireAppContext } from "../../../modules/identity/context";
import { users } from "../../../modules/identity/schema";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("payments") };
}

export default async function PaymentsPage() {
  const t = await getTranslations();
  const labels = (await getTranslations("labels")) as (key: string) => string;
  const context = await requireAppContext();
  const data = await withUser(context.user.id, async (db) => {
    const [user] = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, context.user.id)).limit(1);
    const today = zonedDateISO(new Date(), user?.timezone ?? context.user.timezone);
    return {
      today,
      summary: await paymentSummary(db, context.workspace.workspaceId, today),
      rows: await listPaymentExpectations(db, context.workspace.workspaceId),
    };
  });
  return (
    <div>
      <h1 className="font-display text-4xl">{t("nav.payments")}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">{t("crm.paymentsBody")}</p>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {data.summary.map((item) => (
          <article key={item.currency} className="rounded-2xl bg-sand p-4">
            <p className="text-sm text-muted">{item.currency}</p>
            <p className="mt-2 text-sm">{t("crm.pending")} {formatMoney(item.pending, item.currency, context.user.locale)}</p>
            <p className="text-sm">{t("crm.overdue")} {formatMoney(item.overdue, item.currency, context.user.locale)}</p>
            <p className="text-sm">{t("crm.paid")} {formatMoney(item.paid, item.currency, context.user.locale)}</p>
          </article>
        ))}
      </div>
      <ul className="mt-6 space-y-2">
        {data.rows.map((row) => (
          <li key={row.id} className="rounded-2xl border border-line bg-card px-4 py-3 text-sm">
            <p className="font-medium">{row.brandName}</p>
            <p className="text-muted">
              {row.dealTitle} · {formatMoney(row.amountMinor, row.currency, context.user.locale)} ·{" "}
              {labels(displayPaymentStatus(row.status, row.dueDate, data.today))} · {formatCalendarDate(row.dueDate, context.user.locale)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
