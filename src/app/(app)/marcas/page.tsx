import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { withUser } from "../../../db/client";
import { listBrands } from "../../../modules/crm/queries";
import { requireAppContext } from "../../../modules/identity/context";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("brands") };
}

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const q = Array.isArray(query.q) ? query.q[0] : query.q;
  const nav = await getTranslations("nav");
  const t = await getTranslations("crm");
  const context = await requireAppContext();
  const canEdit = context.workspace.role !== "viewer";
  const rows = await withUser(context.user.id, (db) => listBrands(db, context.workspace.workspaceId, q));
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">{nav("brands")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">{t("brandsIntro")}</p>
        </div>
        {canEdit ? (
          <Link href="/marcas/nueva" className="inline-flex min-h-11 items-center rounded-full bg-clay px-4 py-2 text-sm font-medium text-white">
            {t("newBrand")}
          </Link>
        ) : null}
      </div>
      <form className="mt-4 flex gap-2" method="get">
        <Input name="q" defaultValue={q ?? ""} placeholder={t("searchPlaceholder")} aria-label={t("search")} />
        <Button type="submit">{t("search")}</Button>
      </form>
      {rows.length === 0 ? <p className="mt-6 text-sm text-muted">{t("noBrands")}</p> : (
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
      )}
    </div>
  );
}
