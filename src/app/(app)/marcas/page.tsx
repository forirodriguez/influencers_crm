import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { withUser } from "../../../db/client";
import { listBrands } from "../../../modules/crm/queries";
import { requireAppContext } from "../../../modules/identity/context";

export default async function BrandsPage() {
  const t = await getTranslations();
  const context = await requireAppContext();
  const rows = await withUser(context.user.id, (db) => listBrands(db, context.workspace.workspaceId));
  return (
    <div>
      <h1 className="font-display text-4xl">{t("nav.brands")}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">{t("crm.brandsBody")}</p>
      <ul className="mt-6 grid gap-3 md:grid-cols-2">
        {rows.map((brand) => (
          <li key={brand.id}>
            <Link href={`/marcas/${brand.id}`} className="block rounded-2xl border border-line bg-card p-4">
              <p className="font-medium">{brand.name}</p>
              <p className="text-sm text-muted">{[brand.industry, brand.country].filter(Boolean).join(" · ")}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
