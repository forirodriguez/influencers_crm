import { getTranslations } from "next-intl/server";
import { CURRENCIES } from "../../../../lib/constants";
import { withUser } from "../../../../db/client";
import { listBrands, listContacts, listProfiles, listStages } from "../../../../modules/crm/queries";
import { DealForm } from "../../../../modules/crm/ui/deal-form";
import { requireAppContext } from "../../../../modules/identity/context";
import { redirect } from "next/navigation";

export async function generateMetadata() {
  const t = await getTranslations("crm");
  return { title: t("newDeal") };
}

export default async function NewDealPage() {
  const t = await getTranslations("crm");
  const context = await requireAppContext();
  if (context.workspace.role === "viewer") redirect("/pipeline");
  const data = await withUser(context.user.id, async (db) => {
    const brands = await listBrands(db, context.workspace.workspaceId);
    const contacts = await Promise.all(brands.map(async (brand) => ({
      brandId: brand.id,
      contacts: await listContacts(db, context.workspace.workspaceId, brand.id),
    })));
    return {
      brands,
      profiles: await listProfiles(db, context.workspace.workspaceId),
      stages: await listStages(db, context.workspace.workspaceId),
      contacts,
    };
  });
  const contactsByBrand = Object.fromEntries(
    data.contacts.map((item) => [item.brandId, item.contacts.map((contact) => ({ id: contact.id, name: contact.name }))]),
  );
  return (
    <div>
      <h1 className="font-display text-4xl">{t("newDeal")}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">{t("dealIntro")}</p>
      <DealForm
        brands={data.brands.map((brand) => ({ id: brand.id, name: brand.name }))}
        profiles={data.profiles.map((profile) => ({ id: profile.id, name: profile.displayName }))}
        stages={data.stages.map((stage) => ({ id: stage.id, name: stage.name, kind: stage.kind }))}
        contactsByBrand={contactsByBrand}
        currencies={[...CURRENCIES]}
        defaultCurrency={context.workspace.currency}
      />
    </div>
  );
}
