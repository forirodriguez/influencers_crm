import { getTranslations } from "next-intl/server";
import { withUser } from "../../../db/client";
import { getEnv } from "../../../lib/env.server";
import { formatFollowers } from "../../../lib/labels";
import { formatMoney } from "../../../lib/money";
import { listCreatorProfiles } from "../../../modules/media-kit/queries";
import { requireAppContext } from "../../../modules/identity/context";

export default async function MediaKitEditorPage() {
  const t = await getTranslations();
  const context = await requireAppContext();
  const profiles = await withUser(context.user.id, (db) => listCreatorProfiles(db, context.workspace.workspaceId));
  const origin = getEnv().NEXT_PUBLIC_APP_URL;
  return (
    <div>
      <h1 className="font-display text-4xl">{t("nav.mediaKit")}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">{t("mediaKit.editorBody")}</p>
      <div className="mt-6 space-y-4">
        {profiles.map((profile) => (
          <article key={profile.id} className="rounded-2xl border border-line bg-card p-4">
            <h2 className="font-display text-2xl">{profile.displayName}</h2>
            <p className="text-sm text-muted">{profile.city} {profile.country}</p>
            <a className="mt-2 block text-sm text-clay underline" href={`${origin}/${profile.slug}`}>
              {t("mediaKit.publicLink")}: /{profile.slug}
            </a>
            <ul className="mt-3 text-sm">
              {profile.accounts.map((account) => (
                <li key={account.id}>
                  {account.platform} @{account.handle} · {account.connection === "api" ? t("mediaKit.verified") : t("mediaKit.declared")}
                  {formatFollowers(account.followers, context.user.locale) ? ` · ${formatFollowers(account.followers, context.user.locale)} ${t("mediaKit.followers")}` : ""}
                </li>
              ))}
            </ul>
            <ul className="mt-3 text-sm">
              {profile.services.map((service) => (
                <li key={service.id}>
                  {service.name}
                  {service.priceMinor !== null && service.currency
                    ? ` · ${service.isFromPrice ? `${t("mediaKit.fromPrice")} ` : ""}${formatMoney(service.priceMinor, service.currency, context.user.locale)}`
                    : ""}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
