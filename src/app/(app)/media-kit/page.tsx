import { getTranslations } from "next-intl/server";
import { withUser } from "../../../db/client";
import { getEnv } from "../../../lib/env.server";
import { listWorkspaceProfiles, getPublicMediaKit } from "../../../modules/media-kit/queries";
import { requireAppContext } from "../../../modules/identity/context";
import { MediaKitView } from "../../../modules/media-kit/view";
import { MediaKitEditor } from "./editor";
import { NewProfileForm } from "./new-profile";

export default async function MediaKitEditorPage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string; error?: string; connected?: string }>;
}) {
  const params = await searchParams;
  const t = await getTranslations("mediaKit");
  const nav = await getTranslations("nav");
  const context = await requireAppContext();
  const profiles = await withUser(context.user.id, (db) => listWorkspaceProfiles(db, context.workspace.workspaceId));
  const selected = profiles.find((profile) => profile.id === params.profile) ?? profiles[0] ?? null;
  const kit = selected ? await getPublicMediaKit(selected.slug) : null;
  const origin = getEnv().NEXT_PUBLIC_APP_URL;
  const bannerKey = params.error || (params.connected === "instagram" || params.connected === "tiktok" ? params.connected : "");
  const canEdit = context.workspace.role !== "viewer";
  return (
    <div>
      <h1 className="font-display text-4xl">{nav("mediaKit")}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">{t("editorBody")}</p>
      {bannerKey ? <p className="mt-4 rounded-2xl bg-sand px-4 py-3 text-sm">{bannerText(t, bannerKey)}</p> : null}
      {profiles.length > 1 ? (
        <div className="mt-4 flex gap-2 overflow-x-auto">
          {profiles.map((profile) => (
            <a
              key={profile.id}
              href={`/media-kit?profile=${profile.id}`}
              className={`rounded-full px-3 py-1 text-sm ${profile.id === selected?.id ? "bg-ink text-paper" : "bg-sand"}`}
            >
              {profile.displayName}
            </a>
          ))}
        </div>
      ) : null}
      {canEdit ? <NewProfileForm /> : null}
      {selected && kit ? (
        <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
          <MediaKitEditor
            key={selected.id}
            profile={selected}
            canEdit={canEdit}
            currency={context.workspace.currency}
            simulated={getEnv().INTEGRATIONS_MODE !== "live"}
            publicUrl={`${origin}/${selected.slug}`}
          />
          <aside className="lg:sticky lg:top-4">
            <h2 className="font-display text-2xl">{t("preview")}</h2>
            <p className="mt-1 text-sm text-muted">{t("previewHint")}</p>
            <div className="mt-3 max-h-[85vh] overflow-auto rounded-[2rem] border border-line bg-paper">
              <MediaKitView kit={kit} shareUrl={`${origin}/${selected.slug}`} />
            </div>
          </aside>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">{t("empty")}</p>
      )}
    </div>
  );
}

function bannerText(t: (key: string) => string, key: string): string {
  const known = [
    "instagram",
    "tiktok",
    "instagram_personal",
    "oauth_state",
    "oauth_denied",
    "missing_instagram_keys",
    "missing_tiktok_keys",
    "oauth_failed",
    "token_expired",
    "provider_rate_limited",
    "not_configured",
  ];
  if (known.includes(key)) return t(`banners.${key}`);
  return t("banners.oauth_failed");
}
