import { getTranslations } from "next-intl/server";
import { withUser } from "../../../db/client";
import { formatDateTime } from "../../../lib/dates";
import { listDeliverables } from "../../../modules/crm/queries";
import { requireAppContext } from "../../../modules/identity/context";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("deliverables") };
}

export default async function DeliverablesPage() {
  const t = await getTranslations();
  const labels = (await getTranslations("labels")) as (key: string) => string;
  const context = await requireAppContext();
  const rows = await withUser(context.user.id, (db) => listDeliverables(db, context.workspace.workspaceId));
  return (
    <div>
      <h1 className="font-display text-4xl">{t("nav.deliverables")}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">{t("crm.deliverablesBody")}</p>
      <ul className="mt-6 space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl border border-line bg-card px-4 py-3">
            <p className="font-medium">{row.dealTitle}</p>
            <p className="text-sm text-muted">
              {row.brandName} · {row.quantity} {labels(row.quantity > 1 && row.format === "story" ? "stories" : row.format)} · {labels(row.status)} ·{" "}
              {formatDateTime(row.publishDueAt, context.user.locale, context.user.timezone)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
