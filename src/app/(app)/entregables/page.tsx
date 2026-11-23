import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { withUser } from "../../../db/client";
import { addDays, formatDateTime } from "../../../lib/dates";
import { listDeals, listDeliverables, listUpcomingDeliverables } from "../../../modules/crm/queries";
import { WorkspaceDeliverableForm } from "../../../modules/crm/ui/deal-panels";
import { requireAppContext } from "../../../modules/identity/context";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("deliverables") };
}

export default async function DeliverablesPage() {
  const nav = await getTranslations("nav");
  const t = await getTranslations("crm");
  const labels = (await getTranslations("labels")) as (key: string) => string;
  const context = await requireAppContext();
  const canEdit = context.workspace.role !== "viewer";
  const data = await withUser(context.user.id, async (db) => ({
    week: await listUpcomingDeliverables(db, context.workspace.workspaceId, addDays(new Date(), 7)),
    rows: await listDeliverables(db, context.workspace.workspaceId),
    deals: await listDeals(db, context.workspace.workspaceId),
  }));
  return (
    <div>
      <h1 className="font-display text-4xl">{nav("deliverables")}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">{t("deliverablesIntro")}</p>
      <section className="mt-6">
        <h2 className="font-display text-2xl">{t("thisWeek")}</h2>
        {data.week.length === 0 ? <p className="mt-2 text-sm text-muted">{t("noDeliverables")}</p> : (
          <ul className="mt-3 space-y-2">
            {data.week.map((row) => (
              <li key={row.id}>
                <Link href={`/acuerdos/${row.dealId}`} className="block rounded-2xl border border-line bg-card px-4 py-3">
                  <p className="font-medium">{row.dealTitle}</p>
                  <p className="text-sm text-muted">
                    {row.brandName} · {row.quantity} {labels(row.quantity > 1 && row.format === "story" ? "stories" : row.format)} · {labels(row.status)} · {formatDateTime(row.publishDueAt ?? row.draftDueAt ?? row.approvalDueAt, context.user.locale, context.user.timezone)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <ul className="mt-6 space-y-2">
        {data.rows.map((row) => (
          <li key={row.id}>
            <Link href={`/acuerdos/${row.dealId}`} className="block rounded-2xl border border-line bg-card px-4 py-3">
              <p className="font-medium">{row.dealTitle}</p>
              <p className="text-sm text-muted">
                {row.brandName} · {row.quantity} {labels(row.quantity > 1 && row.format === "story" ? "stories" : row.format)} · {labels(row.status)} · {formatDateTime(row.publishDueAt, context.user.locale, context.user.timezone)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      {canEdit ? (
        <WorkspaceDeliverableForm
          deals={data.deals.map((deal) => ({ id: deal.id, label: `${deal.brandName} · ${deal.title}` }))}
        />
      ) : null}
    </div>
  );
}
