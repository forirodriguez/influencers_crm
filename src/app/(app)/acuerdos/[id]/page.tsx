import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { withUser } from "../../../../db/client";
import { formatMoney } from "../../../../lib/money";
import { getDeal, listDeliverables, listPaymentExpectations } from "../../../../modules/crm/queries";
import { requireAppContext } from "../../../../modules/identity/context";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations();
  const labels = (await getTranslations("labels")) as (key: string) => string;
  const context = await requireAppContext();
  const deal = await withUser(context.user.id, async (db) => {
    const found = await getDeal(db, context.workspace.workspaceId, id);
    if (!found) return null;
    const deliverables = (await listDeliverables(db, context.workspace.workspaceId)).filter((item) => item.dealId === id);
    const payments = (await listPaymentExpectations(db, context.workspace.workspaceId)).filter((item) => item.dealId === id);
    return { found, deliverables, payments };
  });
  if (!deal) notFound();
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">{deal.found.brandName} · {deal.found.stageName}</p>
        <h1 className="font-display text-4xl">{deal.found.title}</h1>
        {deal.found.amountMinor !== null && deal.found.currency ? (
          <p className="mt-2">{formatMoney(deal.found.amountMinor, deal.found.currency, context.user.locale)}</p>
        ) : null}
        <p className="mt-3 max-w-2xl text-sm text-muted">{t("crm.dealBody")}</p>
      </div>
      <section>
        <h2 className="font-display text-2xl">{t("nav.deliverables")}</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {deal.deliverables.map((item) => (
            <li key={item.id} className="rounded-xl border border-line bg-card px-3 py-2">
              {item.quantity} {labels(item.quantity > 1 && item.format === "story" ? "stories" : item.format)} · {item.platform} · {labels(item.status)}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-display text-2xl">{t("nav.payments")}</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {deal.payments.map((item) => (
            <li key={item.id} className="rounded-xl border border-line bg-card px-3 py-2">
              {formatMoney(item.amountMinor, item.currency, context.user.locale)} · {labels(item.status)} · {item.dueDate}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
