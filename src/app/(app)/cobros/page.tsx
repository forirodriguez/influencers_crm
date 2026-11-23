import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { withUser } from "../../../db/client";
import { formatCalendarDate, zonedDateISO } from "../../../lib/dates";
import { formatMoney } from "../../../lib/money";
import { listPaymentExpectations, paymentSummary } from "../../../modules/crm/queries";
import { persistOverdue } from "../../../modules/crm/service";
import { displayPaymentStatus, outstandingMinor } from "../../../modules/crm/status";
import { FollowUp } from "../../../modules/crm/ui/follow-up";
import { requireAppContext } from "../../../modules/identity/context";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("payments") };
}

export default async function PaymentsPage() {
  const nav = await getTranslations("nav");
  const t = await getTranslations("crm");
  const labels = (await getTranslations("labels")) as (key: string) => string;
  const context = await requireAppContext();
  const canEdit = context.workspace.role !== "viewer";
  const today = zonedDateISO(new Date(), context.user.timezone);
  const data = await withUser(context.user.id, async (db) => {
    if (canEdit) await persistOverdue(db, context.workspace.workspaceId, today);
    return {
      summary: await paymentSummary(db, context.workspace.workspaceId, today, context.user.timezone),
      rows: await listPaymentExpectations(db, context.workspace.workspaceId),
    };
  });
  return (
    <div>
      <h1 className="font-display text-4xl">{nav("payments")}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">{t("paymentsIntro")}</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.summary.map((item) => (
          <article key={item.currency} className="rounded-2xl bg-sand p-4">
            <p className="text-sm text-muted">{item.currency}</p>
            <p className="mt-2 text-sm">{t("pendingTotal")} {formatMoney(item.pending, item.currency, context.user.locale)}</p>
            <p className="text-sm">{t("overdueTotal")} {formatMoney(item.overdue, item.currency, context.user.locale)}</p>
            <p className="text-sm">{t("paidTotal")} {formatMoney(item.paid, item.currency, context.user.locale)}</p>
            <p className="text-sm">{t("paidMonth")} {formatMoney(item.paidThisMonth, item.currency, context.user.locale)}</p>
          </article>
        ))}
      </div>
      <ul className="mt-6 space-y-3">
        {data.rows.map((row) => {
          const status = displayPaymentStatus(row.status, row.dueDate, today);
          const outstanding = outstandingMinor(row.amountMinor, row.receivedMinor);
          const open = status !== "paid" && status !== "written_off" && outstanding > 0n;
          const amount = formatMoney(open ? outstanding : row.amountMinor, row.currency, context.user.locale);
          return (
            <li key={row.id} className="space-y-3 rounded-2xl border border-line bg-card px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{row.brandName}</p>
                <p className="text-muted">
                  <Link href={`/acuerdos/${row.dealId}`} className="underline">{row.dealTitle}</Link>
                  {" · "}{formatMoney(row.amountMinor, row.currency, context.user.locale)} · {labels(status)} · {formatCalendarDate(row.dueDate, context.user.locale)}
                </p>
              </div>
              {open ? (
                <FollowUp
                  text={t("followUpText", {
                    who: row.contactName || row.brandName,
                    title: row.dealTitle,
                    amount,
                    due: formatCalendarDate(row.dueDate, context.user.locale),
                    creator: context.user.name ?? "",
                  })}
                  subject={t("followUpSubject", { brand: row.brandName })}
                  phone={row.contactWhatsapp}
                  email={row.contactEmail}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
