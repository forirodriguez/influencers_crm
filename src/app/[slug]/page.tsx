import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { formatCalendarDate } from "../../lib/dates";
import { formatFollowers } from "../../lib/labels";
import { formatMoney } from "../../lib/money";
import { isReservedSlug } from "../../lib/slug";
import { getPublicMediaKit } from "../../modules/media-kit/queries";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (isReservedSlug(slug)) return {};
  const kit = await getPublicMediaKit(slug);
  if (!kit) return {};
  return {
    title: kit.displayName,
    description: kit.bio ?? undefined,
    robots: kit.settings.indexable ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export default async function PublicMediaKitPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (isReservedSlug(slug) || slug.includes(".")) notFound();
  const kit = await getPublicMediaKit(slug);
  if (!kit) notFound();
  const t = await getTranslations();
  const accent = kit.settings.accent || "#b8432f";
  const show = kit.settings.blocks;
  return (
    <main className="mx-auto min-h-screen max-w-lg px-5 py-10">
      <p className="text-xs uppercase tracking-wide text-muted">{t("common.appName")}</p>
      {show.photo && kit.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={kit.photoUrl} alt="" className="mt-6 h-24 w-24 rounded-full object-cover" />
      ) : (
        <div className="mt-6 flex h-24 w-24 items-center justify-center rounded-full text-2xl text-white" style={{ background: accent }}>
          {kit.displayName.slice(0, 1)}
        </div>
      )}
      <h1 className="mt-4 font-display text-5xl">{kit.displayName}</h1>
      <p className="mt-2 text-sm text-muted">{[kit.city, kit.country].filter(Boolean).join(", ")}</p>
      {show.bio && kit.bio ? <p className="mt-4 text-lg">{kit.bio}</p> : null}
      {kit.niches.length > 0 ? <p className="mt-3 text-sm">{kit.niches.join(" · ")}</p> : null}
      {show.metrics ? (
        <ul className="mt-6 space-y-3">
          {kit.accounts.map((account) => (
            <li key={`${account.platform}-${account.handle}`} className="rounded-2xl border border-line bg-card p-4">
              <p className="text-sm uppercase tracking-wide text-muted">{account.platform}</p>
              <p className="font-medium">@{account.handle}</p>
              {formatFollowers(account.followers, "es-AR") ? (
                <p className="text-sm">{formatFollowers(account.followers, "es-AR")} {t("mediaKit.followers")}</p>
              ) : null}
              <p className="text-xs text-muted">
                {account.connection === "api" ? t("mediaKit.verified") : t("mediaKit.declared")}
                {account.capturedAt ? ` · ${t("mediaKit.updated")} ${formatCalendarDate(String(account.capturedAt).slice(0, 10), "es-AR")}` : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      {show.services && kit.services.length > 0 ? (
        <section className="mt-6">
          <h2 className="font-display text-2xl">{t("mediaKit.services")}</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {kit.services.map((service) => (
              <li key={service.name} className="flex justify-between gap-3 rounded-xl bg-sand px-3 py-2">
                <span>{service.name}</span>
                {kit.settings.showPrices && service.priceMinor && service.currency ? (
                  <span>
                    {service.isFromPrice ? `${t("mediaKit.fromPrice")} ` : ""}
                    {formatMoney(service.priceMinor, service.currency, "es-AR")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {show.contact ? (
        <section className="mt-6 text-sm">
          <h2 className="font-display text-2xl">{t("mediaKit.contact")}</h2>
          {kit.publicEmail ? <p className="mt-2">{kit.publicEmail}</p> : null}
          {kit.publicWhatsapp ? <p>{kit.publicWhatsapp}</p> : null}
        </section>
      ) : null}
    </main>
  );
}
