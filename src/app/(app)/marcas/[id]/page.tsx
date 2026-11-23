import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { withUser } from "../../../../db/client";
import { brandContacts, brands } from "../../../../modules/crm/schema";
import { listDeals } from "../../../../modules/crm/queries";
import { requireAppContext } from "../../../../modules/identity/context";

export default async function BrandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations();
  const context = await requireAppContext();
  const data = await withUser(context.user.id, async (db) => {
    const [brand] = await db
      .select()
      .from(brands)
      .where(and(eq(brands.id, id), eq(brands.workspaceId, context.workspace.workspaceId), isNull(brands.deletedAt)))
      .limit(1);
    if (!brand) return null;
    const contacts = await db
      .select()
      .from(brandContacts)
      .where(and(eq(brandContacts.brandId, id), isNull(brandContacts.deletedAt)));
    const deals = (await listDeals(db, context.workspace.workspaceId)).filter((deal) => deal.brandId === id);
    return { brand, contacts, deals };
  });
  if (!data) notFound();
  return (
    <div>
      <h1 className="font-display text-4xl">{data.brand.name}</h1>
      {data.brand.notes ? <p className="mt-3 max-w-2xl text-sm text-muted">{data.brand.notes}</p> : null}
      <h2 className="mt-8 font-display text-2xl">{t("crm.contacts")}</h2>
      <ul className="mt-2 space-y-2 text-sm">
        {data.contacts.map((contact) => (
          <li key={contact.id} className="rounded-xl border border-line bg-card px-3 py-2">
            {contact.name} {contact.role ? `· ${contact.role}` : ""} {contact.email ? `· ${contact.email}` : ""}
          </li>
        ))}
      </ul>
      <h2 className="mt-8 font-display text-2xl">{t("nav.pipeline")}</h2>
      <ul className="mt-2 space-y-2 text-sm">
        {data.deals.map((deal) => (
          <li key={deal.id}>{deal.title} · {deal.stageName}</li>
        ))}
      </ul>
    </div>
  );
}
