import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { withUser } from "../../../../db/client";
import { zonedDateISO } from "../../../../lib/dates";
import { formatMoney } from "../../../../lib/money";
import { brandPaceDays, getBrand, listContacts, listDeals, listPaymentExpectations } from "../../../../modules/crm/queries";
import { BrandForm, ContactForm, DeleteResource } from "../../../../modules/crm/ui/brand-forms";
import { requireAppContext } from "../../../../modules/identity/context";

export default async function BrandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("crm");
  const context = await requireAppContext();
  const canEdit = context.workspace.role !== "viewer";
  const data = await withUser(context.user.id, async (db) => {
    const brand = await getBrand(db, context.workspace.workspaceId, id);
    if (!brand) return null;
    const today = zonedDateISO(new Date(), context.user.timezone);
    const [contacts, deals, payments, paceDays] = await Promise.all([
      listContacts(db, context.workspace.workspaceId, id),
      listDeals(db, context.workspace.workspaceId, { brandId: id, todayISO: today }),
      listPaymentExpectations(db, context.workspace.workspaceId),
      brandPaceDays(db, context.workspace.workspaceId, id),
    ]);
    return { brand, contacts, deals, payments: payments.filter((payment) => payment.brandId === id), paceDays };
  });
  if (!data) notFound();
  const agreed = new Map<string, bigint>();
  for (const deal of data.deals) {
    if (deal.stageKind === "lost") continue;
    if (deal.amountMinor !== null && deal.currency) {
      agreed.set(deal.currency, (agreed.get(deal.currency) ?? 0n) + deal.amountMinor);
    }
  }
  const collected = new Map<string, bigint>();
  for (const payment of data.payments) {
    collected.set(payment.currency, (collected.get(payment.currency) ?? 0n) + payment.receivedMinor);
  }
  const currencies = [...new Set([...agreed.keys(), ...collected.keys()])];
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl">{data.brand.name}</h1>
        <p className="mt-2 text-sm text-muted">{[data.brand.industry, data.brand.country, data.brand.website].filter(Boolean).join(" · ")}</p>
        {data.brand.notes ? <p className="mt-3 max-w-2xl text-sm">{data.brand.notes}</p> : null}
      </div>
      <section className="grid gap-3 sm:grid-cols-2">
        {currencies.map((currency) => (
          <article key={currency} className="rounded-2xl bg-sand p-4 text-sm">
            <p className="text-muted">{currency}</p>
            <p>{t("agreed")} {formatMoney(agreed.get(currency) ?? 0n, currency, context.user.locale)}</p>
            <p>{t("collected")} {formatMoney(collected.get(currency) ?? 0n, currency, context.user.locale)}</p>
          </article>
        ))}
        <article className="rounded-2xl border border-line bg-card p-4 text-sm">
          <p className="text-muted">{t("pace")}</p>
          <p>{data.paceDays === null ? t("paceEmpty") : t("paceDays", { days: String(data.paceDays) })}</p>
        </article>
      </section>
      <section>
        <h2 className="font-display text-2xl">{t("contacts")}</h2>
        {data.contacts.length === 0 ? <p className="mt-2 text-sm text-muted">{t("noContacts")}</p> : (
          <ul className="mt-3 space-y-2 text-sm">
            {data.contacts.map((contact) => (
              <li key={contact.id} className="flex items-start justify-between gap-3 rounded-xl border border-line bg-card px-3 py-2">
                <div>
                  <p className="font-medium">{contact.name}{contact.role ? ` · ${contact.role}` : ""}</p>
                  <p className="text-muted">{[contact.email, contact.whatsappE164, contact.instagram].filter(Boolean).join(" · ")}</p>
                </div>
                {canEdit ? <DeleteResource url={`/api/v1/brands/${id}/contacts/${contact.id}`} redirectTo={`/marcas/${id}`} /> : null}
              </li>
            ))}
          </ul>
        )}
        {canEdit ? <ContactForm brandId={id} /> : null}
      </section>
      <section>
        <h2 className="font-display text-2xl">{t("deals")}</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {data.deals.map((deal) => (
            <li key={deal.id}>
              <Link href={`/acuerdos/${deal.id}`} className="underline">{deal.title}</Link> · {deal.stageName}
            </li>
          ))}
        </ul>
      </section>
      {canEdit ? (
        <section>
          <h2 className="font-display text-2xl">{t("edit")}</h2>
          <BrandForm
            brandId={id}
            initial={{
              name: data.brand.name,
              website: data.brand.website ?? "",
              instagram: data.brand.instagram ?? "",
              tiktok: data.brand.tiktok ?? "",
              industry: data.brand.industry ?? "",
              country: data.brand.country ?? "",
              notes: data.brand.notes ?? "",
            }}
          />
          <div className="mt-4">
            <DeleteResource url={`/api/v1/brands/${id}`} redirectTo="/marcas" />
          </div>
        </section>
      ) : null}
    </div>
  );
}
