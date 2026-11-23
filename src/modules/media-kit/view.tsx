"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatCalendarDate } from "../../lib/dates";
import { formatMoney } from "../../lib/money";
import { NICHE_OPTIONS, demographicGroups, normalizeSettings } from "./settings";
import type { PublicAccount, PublicMediaKit } from "./types";

export function MediaKitView({ kit, shareUrl }: { kit: PublicMediaKit; shareUrl?: string }) {
  const t = useTranslations("mediaKit");
  const app = useTranslations("common");
  const locale = useLocale();
  const settings = normalizeSettings(kit.settings);
  const show = settings.blocks;
  const accent = settings.accent;
  const regions = new Intl.DisplayNames([locale], { type: "region" });
  return (
    <article className="mx-auto w-full max-w-lg px-5 py-8">
      <p className="text-xs uppercase tracking-[0.18em]" style={{ color: accent }}>
        {app("appName")}
      </p>
      <header className="mt-4 rounded-[28px] border border-line bg-card p-6">
        {show.photo ? (
          kit.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={kit.photoUrl} alt="" className="h-24 w-24 rounded-full object-cover" />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full text-3xl text-white" style={{ background: accent }}>
              {kit.displayName.slice(0, 1)}
            </div>
          )
        ) : null}
        <h1 className="mt-4 break-words font-display text-4xl leading-tight sm:text-5xl sm:leading-none">{kit.displayName}</h1>
        <p className="mt-3 text-sm text-muted">{[kit.city, countryName(kit.country, regions)].filter(Boolean).join(" · ")}</p>
        {show.niches && kit.niches.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {kit.niches.map((niche) => (
              <li key={niche} className="rounded-full px-3 py-1 text-xs" style={{ background: `${accent}1a`, color: accent }}>
                {nicheLabel(niche, t)}
              </li>
            ))}
          </ul>
        ) : null}
        {show.bio && kit.bio ? <p className="mt-4 break-words text-lg leading-relaxed">{kit.bio}</p> : null}
        {kit.languages.length > 0 ? <p className="mt-3 text-xs uppercase tracking-wide text-muted">{kit.languages.join(" · ")}</p> : null}
      </header>

      {show.metrics ? (
        <div className="mt-4 space-y-3">
          {kit.accounts.map((account) => (
            <AccountCard key={`${account.platform}-${account.handle}`} account={account} accent={accent} locale={locale} />
          ))}
        </div>
      ) : null}

      {show.audience ? <Audience kit={kit} accent={accent} regions={regions} /> : null}

      {show.services && kit.services.length > 0 ? (
        <section className="mt-4 rounded-[28px] border border-line bg-card p-6">
          <h2 className="font-display text-3xl">{t("services")}</h2>
          <ul className="mt-4 divide-y divide-line">
            {kit.services.map((service) => (
              <li key={`${service.name}-${service.platform}`} className="flex items-baseline justify-between gap-4 py-3 text-sm">
                <span>
                  <span className="block font-medium">{service.name}</span>
                  {service.platform ? <span className="text-muted">{platformLabel(service.platform, t)}</span> : null}
                </span>
                {settings.showPrices && service.priceMinor && service.currency ? (
                  <span className="shrink-0 font-medium">
                    {service.isFromPrice ? `${t("fromPrice")} ` : ""}
                    {formatMoney(service.priceMinor, service.currency, locale)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {show.featured && settings.featured.length > 0 ? (
        <section className="mt-4 rounded-[28px] border border-line bg-card p-6">
          <h2 className="font-display text-3xl">{t("featuredTitle")}</h2>
          <ul className="mt-4 space-y-3">
            {settings.featured.map((item) => (
              <li key={item.id} className="flex items-center gap-3">
                <Logo src={item.logoUrl} name={item.brand} accent={accent} />
                <div>
                  <p className="font-medium">{item.brand}</p>
                  {item.detail ? <p className="text-sm text-muted">{item.detail}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {show.posts ? <Posts kit={kit} /> : null}

      {show.contact && (kit.publicEmail || kit.publicWhatsapp) ? (
        <section className="mt-4 grid gap-2">
          {kit.publicEmail ? (
            <a className="rounded-full px-4 py-3 text-center text-sm font-medium text-white" style={{ background: accent }} href={`mailto:${kit.publicEmail}`}>
              {t("contactEmail")}
            </a>
          ) : null}
          {kit.publicWhatsapp ? (
            <a
              className="rounded-full border border-line bg-card px-4 py-3 text-center text-sm font-medium"
              href={`https://wa.me/${kit.publicWhatsapp.replace(/[^\d]/g, "")}`}
            >
              {t("contactWhatsapp")}
            </a>
          ) : null}
        </section>
      ) : null}

      {shareUrl ? <ShareBar url={shareUrl} /> : null}
    </article>
  );
}

function AccountCard({ account, accent, locale }: { account: PublicAccount; accent: string; locale: string }) {
  const t = useTranslations("mediaKit");
  const metrics = [
    [t("followers"), formatCount(account.followers, locale)],
    [t("following"), formatCount(account.following, locale)],
    [t("postsCount"), formatCount(account.mediaCount, locale)],
    [t("likes"), formatCount(account.likesTotal, locale)],
    [t("reach"), formatCount(account.reach30d, locale)],
    [t("views"), formatCount(account.views30d, locale)],
    [t("interactions"), formatCount(account.interactions30d, locale)],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  return (
    <section className="rounded-[28px] border border-line bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">{platformLabel(account.platform, t)}</p>
          <p className="font-display text-3xl">@{account.handle}</p>
        </div>
        <span className="rounded-full px-3 py-1 text-xs" style={{ background: account.connection === "api" ? accent : "#efe6db", color: account.connection === "api" ? "white" : "#241c18" }}>
          {account.connection === "api" ? t("verified") : t("declared")}
        </span>
      </div>
      {metrics.length > 0 ? (
        <dl className="mt-4 grid grid-cols-2 gap-3">
          {metrics.map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-sand px-3 py-3">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="font-display text-2xl">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {account.capturedAt ? (
        <p className="mt-3 text-xs text-muted">
          {t("updated")} {formatCalendarDate(String(account.capturedAt).slice(0, 10), locale)}
        </p>
      ) : null}
    </section>
  );
}

function Audience({ kit, accent, regions }: { kit: PublicMediaKit; accent: string; regions: Intl.DisplayNames }) {
  const t = useTranslations("mediaKit");
  const settings = normalizeSettings(kit.settings);
  const declared = settings.declaredAudience;
  const instagram = kit.accounts.find((account) => account.platform === "instagram");
  const tiktok = kit.accounts.find((account) => account.platform === "tiktok" && account.connection === "api");
  const groups = instagram?.demographics
    ? [
        ["countries", demographicGroups(instagram.demographics, ["countries"])],
        ["cities", demographicGroups(instagram.demographics, ["cities"])],
        ["ages", demographicGroups(instagram.demographics, ["ages"])],
        ["genders", demographicGroups(instagram.demographics, ["genders"])],
      ].filter((entry) => (entry[1] as { label: string }[]).length > 0)
    : [];
  const showUnder100 = Boolean(instagram && instagram.connection === "api" && (instagram.followers ?? 0) < 100);
  if (!showUnder100 && !tiktok && groups.length === 0 && !declared) return null;
  return (
    <section className="mt-4 rounded-[28px] border border-line bg-card p-6">
      <h2 className="font-display text-3xl">{t("audienceTitle")}</h2>
      {showUnder100 ? <p className="mt-3 text-sm text-muted">{t("under100")}</p> : null}
      {groups.map(([key, slices]) => (
        <Group
          key={String(key)}
          title={t(key === "countries" ? "countries" : key === "cities" ? "cities" : key === "ages" ? "ages" : "genders")}
          rows={(slices as { label: string; share: number }[]).map((slice) => ({
            label: labelFor(String(key), slice.label, t, regions),
            share: slice.share,
          }))}
          accent={accent}
          badge={t("verified")}
        />
      ))}
      {tiktok ? <p className="mt-3 text-sm text-muted">{t("tiktokAudience")}</p> : null}
      {declared ? (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wide text-muted">{t("declared")}</p>
          {declared.summary ? <p className="mt-2 text-sm">{declared.summary}</p> : null}
          <Group title={t("countries")} rows={declared.countries} accent={accent} badge={t("declared")} />
          <Group title={t("ages")} rows={declared.ages} accent={accent} badge={t("declared")} />
          <Group title={t("genders")} rows={declared.genders} accent={accent} badge={t("declared")} />
        </div>
      ) : null}
    </section>
  );
}

function Group({
  title,
  rows,
  accent,
  badge,
}: {
  title: string;
  rows: Array<{ label: string; share: number }>;
  accent: string;
  badge: string;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs text-muted">{badge}</span>
      </div>
      <ul className="mt-2 space-y-2">
        {rows.map((row) => (
          <li key={`${title}-${row.label}`}>
            <div className="flex justify-between text-xs">
              <span>{row.label}</span>
              <span>{Math.round(row.share * 100)}%</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-sand">
              <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, Math.round(row.share * 100))}%`, background: accent }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Posts({ kit }: { kit: PublicMediaKit }) {
  const posts = kit.accounts.flatMap((account) => account.posts.map((post) => ({ ...post, platform: account.platform })));
  if (posts.length === 0) return null;
  return (
    <section className="mt-4">
      <ul className="grid grid-cols-3 gap-2">
        {posts.slice(0, 6).map((post, index) => (
          <li key={`${post.url ?? post.type}-${index}`} className="aspect-square overflow-hidden rounded-2xl bg-sand">
            {post.url ? (
              <a href={post.url} target="_blank" rel="noreferrer" className="block h-full w-full">
                <PostFace post={post} />
              </a>
            ) : (
              <PostFace post={post} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PostFace({ post }: { post: { thumbnailUrl: string | null; type: string | null; metrics: Record<string, number> } }) {
  if (post.thumbnailUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={post.thumbnailUrl} alt="" className="h-full w-full object-cover" />;
  }
  return (
    <div className="flex h-full flex-col justify-end p-2 text-xs">
      <span className="uppercase text-muted">{post.type ?? "post"}</span>
      {post.metrics.views ? <span>{new Intl.NumberFormat("es-UY").format(post.metrics.views)}</span> : null}
    </div>
  );
}

function ShareBar({ url }: { url: string }) {
  const t = useTranslations("mediaKit");
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="mt-6 w-full rounded-full border border-line bg-card px-4 py-3 text-sm"
      onClick={async () => {
        const nav = navigator as Navigator & { share?: (data: { url: string }) => Promise<void> };
        if (nav.share) {
          try {
            await nav.share({ url });
            return;
          } catch {
            /* el usuario canceló o el navegador no completó el share */
          }
        }
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }}
    >
      {copied ? t("copied") : t("share")}
    </button>
  );
}

function Logo({ src, name, accent }: { src: string; name: string; accent: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) setReady(true);
    };
    image.onerror = () => {
      if (!cancelled) setReady(false);
    };
    image.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);
  if (!ready) {
    return (
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm text-white" style={{ background: accent }}>
        {name.slice(0, 1)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-12 w-12 shrink-0 rounded-full bg-sand object-contain" onError={() => setReady(false)} />
  );
}

function formatCount(value: number | string | null | undefined, locale: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return new Intl.NumberFormat(locale).format(numeric);
}

function countryName(code: string | null, regions: Intl.DisplayNames): string | null {
  if (!code) return null;
  try {
    return regions.of(code) ?? code;
  } catch {
    return code;
  }
}

function nicheLabel(id: string, t: (key: string) => string): string {
  const option = NICHE_OPTIONS.find((item) => item.id === id);
  return option ? t(`niches.${option.key}`) : id;
}

function platformLabel(platform: string, t: (key: string) => string): string {
  if (platform === "instagram" || platform === "tiktok" || platform === "youtube" || platform === "other") {
    return t(`platforms.${platform}`);
  }
  return platform;
}

function labelFor(group: string, label: string, t: (key: string) => string, regions: Intl.DisplayNames): string {
  if (group === "countries" && /^[A-Z]{2}$/.test(label)) return countryName(label, regions) ?? label;
  if (group === "genders" && (label === "F" || label === "M" || label === "U")) return t(`gender.${label}`);
  return label;
}
