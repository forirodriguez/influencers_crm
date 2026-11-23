import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BrandForm } from "../../../../modules/crm/ui/brand-forms";
import { requireAppContext } from "../../../../modules/identity/context";

export async function generateMetadata() {
  const t = await getTranslations("crm");
  return { title: t("newBrand") };
}

export default async function NewBrandPage() {
  const t = await getTranslations("crm");
  const context = await requireAppContext();
  if (context.workspace.role === "viewer") redirect("/marcas");
  return (
    <div>
      <h1 className="font-display text-4xl">{t("newBrand")}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">{t("brandsIntro")}</p>
      <BrandForm />
    </div>
  );
}
