import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { withUser } from "../../../db/client";
import { formatMoney } from "../../../lib/money";
import { listDeals, listStages } from "../../../modules/crm/queries";
import { requireAppContext } from "../../../modules/identity/context";

export default async function PipelinePage() {
  const t = await getTranslations();
  const context = await requireAppContext();
  const data = await withUser(context.user.id, async (db) => ({
    stages: await listStages(db, context.workspace.workspaceId),
    deals: await listDeals(db, context.workspace.workspaceId),
  }));
  return (
    <div>
      <h1 className="font-display text-4xl">{t("nav.pipeline")}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">{t("crm.pipelineBody")}</p>
      <div className="mt-6 flex gap-3 overflow-x-auto pb-4">
        {data.stages.map((stage) => {
          const cards = data.deals.filter((deal) => deal.stageId === stage.id);
          return (
            <section key={stage.id} className="min-w-64 flex-1 rounded-2xl bg-sand p-3">
              <h2 className="text-sm font-medium">
                {stage.name} <span className="text-muted">{cards.length}</span>
              </h2>
              <ul className="mt-3 space-y-2">
                {cards.map((deal) => (
                  <li key={deal.id}>
                    <Link href={`/acuerdos/${deal.id}`} className="block rounded-xl bg-card p-3">
                      <p className="font-medium">{deal.title}</p>
                      <p className="text-sm text-muted">{deal.brandName}</p>
                      {deal.amountMinor !== null && deal.currency ? (
                        <p className="mt-2 text-sm">{formatMoney(deal.amountMinor, deal.currency, context.user.locale)}</p>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
