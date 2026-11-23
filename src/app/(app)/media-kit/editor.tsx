"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "../../../components/ui/button";
import { Input, Label, Select } from "../../../components/ui/input";
import { CURRENCIES } from "../../../lib/constants";
import { ACCENT_PRESETS, NICHE_OPTIONS } from "../../../modules/media-kit/settings";
import type { MediaKitBlocks, MediaKitSettings } from "../../../modules/media-kit/schema";
import type { EditorProfile } from "../../../modules/media-kit/types";

type SliceRow = { label: string; percent: string };

export function MediaKitEditor({
  profile,
  canEdit,
  currency,
  simulated,
  publicUrl,
}: {
  profile: EditorProfile;
  canEdit: boolean;
  currency: string;
  simulated: boolean;
  publicUrl: string;
}) {
  const t = useTranslations("mediaKit");
  const router = useRouter();
  const [form, setForm] = useState(() => fromProfile(profile));
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  async function saveProfile() {
    setPending(true);
    setNotice(null);
    try {
      await send(`/api/v1/creator-profiles/${profile.id}`, "PATCH", {
        displayName: form.displayName,
        slug: form.slug,
        bio: form.bio,
        photoUrl: form.photoUrl,
        country: form.country || null,
        city: form.city,
        niches: form.niches,
        languages: form.languages.split(",").map((item) => item.trim()).filter(Boolean),
        publicEmail: form.publicEmail,
        publicWhatsapp: form.publicWhatsapp,
        settings: settingsFrom(form),
      });
      setNotice(t("saved"));
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t("banners.oauth_failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-line bg-card p-4">
        <p className="text-xs uppercase tracking-wide text-muted">{t("publicLink")}</p>
        <p className="mt-1 break-all text-sm">{publicUrl}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(publicUrl);
              setCopied(true);
            }}
          >
            {copied ? t("copied") : t("copyLink")}
          </Button>
          <a className="inline-flex min-h-11 items-center rounded-full border border-line px-4 py-2 text-sm" href={publicUrl}>
            {t("openPublic")}
          </a>
          <a className="inline-flex min-h-11 items-center rounded-full border border-line px-4 py-2 text-sm" href={`${publicUrl}/opengraph-image`}>
            {t("shareImage")}
          </a>
        </div>
      </div>

      {simulated ? <p className="rounded-2xl bg-sand px-4 py-3 text-sm">{t("simulated")}</p> : null}
      {!canEdit ? <p className="text-sm text-muted">{t("viewer")}</p> : null}

      <fieldset disabled={!canEdit || pending} className="space-y-6 disabled:opacity-70">
        <Section title={t("sections.profile")}>
          <Field label={t("fields.displayName")}>
            <Input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
          </Field>
          <Field label={t("fields.slug")}>
            <Input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} />
          </Field>
          <Field label={t("fields.bio")}>
            <textarea
              aria-label={t("fields.bio")}
              className="min-h-28 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm"
              maxLength={280}
              value={form.bio}
              onChange={(event) => setForm({ ...form, bio: event.target.value })}
            />
            <p className="mt-1 text-xs text-muted">{form.bio.length}/280</p>
          </Field>
          <Field label={t("fields.photo")}>
            <Input value={form.photoUrl} onChange={(event) => setForm({ ...form, photoUrl: event.target.value })} placeholder="https://" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("fields.country")}>
              <Select value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })}>
                <option value="">—</option>
                <option value="AR">AR</option>
                <option value="MX">MX</option>
                <option value="CO">CO</option>
                <option value="UY">UY</option>
              </Select>
            </Field>
            <Field label={t("fields.city")}>
              <Input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
            </Field>
          </div>
          <Field label={t("fields.languages")}>
            <Input value={form.languages} onChange={(event) => setForm({ ...form, languages: event.target.value })} />
            <p className="mt-1 text-xs text-muted">{t("fields.languagesHint")}</p>
          </Field>
          <Field label={t("fields.publicEmail")}>
            <Input value={form.publicEmail} onChange={(event) => setForm({ ...form, publicEmail: event.target.value })} />
          </Field>
          <Field label={t("fields.publicWhatsapp")}>
            <Input value={form.publicWhatsapp} onChange={(event) => setForm({ ...form, publicWhatsapp: event.target.value })} placeholder="+54 9 11 0000 0000" />
          </Field>
        </Section>

        <Section title={t("sections.niches")}>
          <div className="flex flex-wrap gap-2">
            {NICHE_OPTIONS.map((option) => {
              const on = form.niches.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  className="rounded-full border px-3 py-1 text-sm"
                  style={on ? { background: form.accent, color: "white", borderColor: form.accent } : undefined}
                  onClick={() =>
                    setForm({
                      ...form,
                      niches: on ? form.niches.filter((item) => item !== option.id) : [...form.niches, option.id],
                    })
                  }
                >
                  {t(`niches.${option.key}`)}
                </button>
              );
            })}
            {form.niches
              .filter((niche) => !NICHE_OPTIONS.some((option) => option.id === niche))
              .map((niche) => (
                <button key={niche} type="button" className="rounded-full bg-sand px-3 py-1 text-sm" onClick={() => setForm({ ...form, niches: form.niches.filter((item) => item !== niche) })}>
                  {niche} ×
                </button>
              ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              value={form.customNiche}
              placeholder={t("fields.nicheCustom")}
              onChange={(event) => setForm({ ...form, customNiche: event.target.value })}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const niche = form.customNiche.trim();
                if (!niche || form.niches.includes(niche)) return;
                setForm({ ...form, niches: [...form.niches, niche], customNiche: "" });
              }}
            >
              {t("add")}
            </Button>
          </div>
        </Section>

        <Section title={t("sections.networks")}>
          <p className="text-sm text-muted">{t("personalBody")}</p>
          {canEdit ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <a className="rounded-full bg-clay px-4 py-2 text-sm text-white" href={`/api/v1/social/instagram/connect?profileId=${profile.id}`}>
                {t("connectInstagram")}
              </a>
              <a className="rounded-full bg-ink px-4 py-2 text-sm text-paper" href={`/api/v1/social/tiktok/connect?profileId=${profile.id}`}>
                {t("connectTikTok")}
              </a>
            </div>
          ) : null}
          <ul className="mt-4 space-y-3">
            {profile.accounts.map((account) => (
              <li key={account.id} className="rounded-2xl border border-line p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p>
                    {t(`platforms.${account.platform as "instagram" | "tiktok" | "youtube" | "other"}`)} @{account.handle}
                  </p>
                  <span className="text-xs text-muted">{account.connection === "api" ? t("verified") : t("declared")}</span>
                </div>
                <p className="mt-1 text-muted">
                  {t(`status.${account.status as "active" | "expired" | "revoked" | "error"}`)}
                  {account.followers !== null ? ` · ${new Intl.NumberFormat().format(account.followers)} ${t("followers")}` : ""}
                </p>
                {account.demographicsHidden ? <p className="mt-2 text-muted">{t("under100")}</p> : null}
                {account.platform === "tiktok" && account.connection === "api" ? <p className="mt-2 text-muted">{t("tiktokAudience")}</p> : null}
                <div className="mt-3 flex gap-2">
                  {account.connection === "api" ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => run(`/api/v1/social-accounts/${account.id}/sync`, "POST", undefined, setNotice, t("saved"), router)}
                    >
                      {t("sync")}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => run(`/api/v1/social-accounts/${account.id}`, "DELETE", undefined, setNotice, t("saved"), router)}
                  >
                    {t("disconnect")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted">{t("manualHint")}</p>
          <ManualAccountForm profileId={profile.id} onDone={() => router.refresh()} />
        </Section>

        <Section title={t("sections.rates")}>
          <Services profileId={profile.id} services={profile.services} currency={currency} onDone={() => router.refresh()} />
        </Section>

        <Section title={t("sections.audience")}>
          <p className="text-sm text-muted">{t("audienceHint")}</p>
          <Field label={t("audienceSummary")}>
            <textarea
              className="min-h-20 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm"
              value={form.summary}
              onChange={(event) => setForm({ ...form, summary: event.target.value })}
            />
          </Field>
          <SliceEditor title={t("countries")} rows={form.countries} onChange={(countries) => setForm({ ...form, countries })} />
          <SliceEditor title={t("ages")} rows={form.ages} onChange={(ages) => setForm({ ...form, ages })} />
          <SliceEditor title={t("genders")} rows={form.genders} onChange={(genders) => setForm({ ...form, genders })} />
        </Section>

        <Section title={t("sections.featured")}>
          <p className="text-sm text-muted">{t("featuredHint")}</p>
          {form.featured.map((item, index) => (
            <div key={item.id} className="mt-3 grid gap-2 rounded-2xl border border-line p-3">
              <Input placeholder={t("brand")} value={item.brand} onChange={(event) => updateFeatured(index, { brand: event.target.value })} />
              <Input placeholder={t("logoUrl")} value={item.logoUrl} onChange={(event) => updateFeatured(index, { logoUrl: event.target.value })} />
              <Input placeholder={t("detail")} value={item.detail} onChange={(event) => updateFeatured(index, { detail: event.target.value })} />
              <button type="button" className="text-left text-sm text-clay" onClick={() => setForm({ ...form, featured: form.featured.filter((row) => row.id !== item.id) })}>
                {t("remove")}
              </button>
            </div>
          ))}
          <Button
            type="button"
            className="mt-3"
            variant="secondary"
            onClick={() =>
              setForm({
                ...form,
                featured: [...form.featured, { id: crypto.randomUUID(), brand: "", logoUrl: "", detail: "" }],
              })
            }
          >
            {t("addFeatured")}
          </Button>
        </Section>

        <Section title={t("sections.visibility")}>
          <div className="flex flex-wrap gap-2">
            {ACCENT_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={t("fields.accent")}
                className="h-8 w-8 rounded-full border-2"
                style={{ background: color, borderColor: form.accent === color ? "#241c18" : "transparent" }}
                onClick={() => setForm({ ...form, accent: color })}
              />
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.showPrices} onChange={(event) => setForm({ ...form, showPrices: event.target.checked })} />
            {t("fields.showPrices")}
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.indexable} onChange={(event) => setForm({ ...form, indexable: event.target.checked })} />
            {t("fields.indexable")}
          </label>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {(Object.keys(form.blocks) as Array<keyof MediaKitBlocks>).map((key) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.blocks[key]}
                  onChange={(event) => setForm({ ...form, blocks: { ...form.blocks, [key]: event.target.checked } })}
                />
                {t(`blocks.${key}`)}
              </label>
            ))}
          </div>
        </Section>

        <Button type="button" onClick={saveProfile} disabled={pending}>
          {t("save")}
        </Button>
        {notice ? <p className="text-sm">{notice}</p> : null}
      </fieldset>
    </div>
  );

  function updateFeatured(index: number, patch: Partial<{ brand: string; logoUrl: string; detail: string }>) {
    setForm({
      ...form,
      featured: form.featured.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    });
  }
}

function ManualAccountForm({ profileId, onDone }: { profileId: string; onDone: () => void }) {
  const t = useTranslations("mediaKit");
  const [platform, setPlatform] = useState("instagram");
  const [handle, setHandle] = useState("");
  const [followers, setFollowers] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-3 grid gap-2 sm:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        try {
          await send(`/api/v1/creator-profiles/${profileId}/accounts`, "POST", {
            platform,
            handle,
            followers: followers ? Number(followers) : null,
          });
          setHandle("");
          setFollowers("");
          onDone();
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : t("banners.oauth_failed"));
        }
      }}
    >
      <Select value={platform} onChange={(event) => setPlatform(event.target.value)} aria-label={t("fields.platform")}>
        <option value="instagram">{t("platforms.instagram")}</option>
        <option value="tiktok">{t("platforms.tiktok")}</option>
        <option value="youtube">{t("platforms.youtube")}</option>
        <option value="other">{t("platforms.other")}</option>
      </Select>
      <Input value={handle} placeholder={t("handle")} aria-label={t("handle")} onChange={(event) => setHandle(event.target.value)} />
      <Input value={followers} inputMode="numeric" placeholder={t("followers")} aria-label={t("followers")} onChange={(event) => setFollowers(event.target.value)} />
      <Button type="submit" variant="secondary">
        {t("addManual")}
      </Button>
      {error ? <p className="text-sm sm:col-span-2">{error}</p> : null}
    </form>
  );
}

function Services({
  profileId,
  services,
  currency,
  onDone,
}: {
  profileId: string;
  services: EditorProfile["services"];
  currency: string;
  onDone: () => void;
}) {
  const t = useTranslations("mediaKit");
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [price, setPrice] = useState("");
  const [money, setMoney] = useState(currency);
  const [fromPrice, setFromPrice] = useState(true);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <ul className="space-y-2 text-sm">
        {services.map((service) => (
          <li key={service.id} className="flex items-center justify-between gap-3 rounded-xl bg-sand px-3 py-2">
            <span>
              {service.name}
              {service.priceMinor && service.currency ? ` · ${service.currency}` : ""}
              {!service.visible ? ` · ${t("blocks.services")}` : ""}
            </span>
            <button
              type="button"
              className="text-clay"
              onClick={async () => {
                await send(`/api/v1/creator-profiles/${profileId}/services/${service.id}`, "DELETE");
                onDone();
              }}
            >
              {t("remove")}
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 grid gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          try {
            await send(`/api/v1/creator-profiles/${profileId}/services`, "POST", {
              name,
              platform,
              price,
              currency: money,
              isFromPrice: fromPrice,
              visible: true,
            });
            setName("");
            setPrice("");
            onDone();
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : t("banners.oauth_failed"));
          }
        }}
      >
        <Input value={name} placeholder={t("fields.serviceName")} aria-label={t("fields.serviceName")} onChange={(event) => setName(event.target.value)} />
        <div className="grid gap-2 sm:grid-cols-3">
          <Select value={platform} aria-label={t("fields.platform")} onChange={(event) => setPlatform(event.target.value)}>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="youtube">YouTube</option>
            <option value="">{t("platforms.other")}</option>
          </Select>
          <Input value={price} inputMode="decimal" placeholder={t("fields.price")} aria-label={t("fields.price")} onChange={(event) => setPrice(event.target.value)} />
          <Select value={money} aria-label={t("fields.currency")} onChange={(event) => setMoney(event.target.value)}>
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={fromPrice} onChange={(event) => setFromPrice(event.target.checked)} />
          {t("fields.fromToggle")}
        </label>
        <Button type="submit" variant="secondary">
          {t("add")}
        </Button>
        {error ? <p className="text-sm">{error}</p> : null}
      </form>
    </div>
  );
}

function SliceEditor({ title, rows, onChange }: { title: string; rows: SliceRow[]; onChange: (rows: SliceRow[]) => void }) {
  const t = useTranslations("mediaKit");
  return (
    <div className="mt-3">
      <p className="text-sm font-medium">{title}</p>
      {rows.map((row, index) => (
        <div key={`${title}-${index}`} className="mt-2 grid grid-cols-[1fr_5rem_auto] gap-2">
          <Input
            value={row.label}
            aria-label={title}
            onChange={(event) => onChange(rows.map((item, itemIndex) => (itemIndex === index ? { ...item, label: event.target.value } : item)))}
          />
          <Input
            value={row.percent}
            inputMode="numeric"
            aria-label={t("percent")}
            onChange={(event) => onChange(rows.map((item, itemIndex) => (itemIndex === index ? { ...item, percent: event.target.value } : item)))}
          />
          <button type="button" className="text-sm text-clay" onClick={() => onChange(rows.filter((_, itemIndex) => itemIndex !== index))}>
            {t("remove")}
          </button>
        </div>
      ))}
      <button type="button" className="mt-2 text-sm text-clay" onClick={() => onChange([...rows, { label: "", percent: "" }])}>
        {t("add")}
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-card p-4">
      <h2 className="font-display text-2xl">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

async function send(path: string, method: string, body?: unknown) {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json()) as { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? "Error");
  return payload;
}

async function run(
  path: string,
  method: string,
  body: unknown,
  setNotice: (value: string) => void,
  ok: string,
  router: { refresh: () => void },
) {
  try {
    await send(path, method, body);
    setNotice(ok);
    router.refresh();
  } catch (error) {
    setNotice(error instanceof Error ? error.message : ok);
  }
}

type FormState = {
  displayName: string;
  slug: string;
  bio: string;
  photoUrl: string;
  country: string;
  city: string;
  languages: string;
  niches: string[];
  customNiche: string;
  publicEmail: string;
  publicWhatsapp: string;
  accent: string;
  indexable: boolean;
  showPrices: boolean;
  blocks: MediaKitBlocks;
  featured: MediaKitSettings["featured"];
  summary: string;
  countries: SliceRow[];
  ages: SliceRow[];
  genders: SliceRow[];
};

function fromProfile(profile: EditorProfile): FormState {
  const audience = profile.settings.declaredAudience;
  return {
    displayName: profile.displayName,
    slug: profile.slug,
    bio: profile.bio ?? "",
    photoUrl: profile.photoUrl ?? "",
    country: profile.country ?? "",
    city: profile.city ?? "",
    languages: profile.languages.join(", "),
    niches: profile.niches,
    customNiche: "",
    publicEmail: profile.publicEmail ?? "",
    publicWhatsapp: profile.publicWhatsapp ?? "",
    accent: profile.settings.accent,
    indexable: profile.settings.indexable,
    showPrices: profile.settings.showPrices,
    blocks: profile.settings.blocks,
    featured: profile.settings.featured,
    summary: audience?.summary ?? "",
    countries: (audience?.countries ?? []).map(toRow),
    ages: (audience?.ages ?? []).map(toRow),
    genders: (audience?.genders ?? []).map(toRow),
  };
}

function toRow(slice: { label: string; share: number }): SliceRow {
  return { label: slice.label, percent: String(Math.round(slice.share * 100)) };
}

function settingsFrom(form: FormState): MediaKitSettings {
  const audience = {
    summary: form.summary.trim(),
    countries: rowsToSlices(form.countries),
    ages: rowsToSlices(form.ages),
    genders: rowsToSlices(form.genders),
  };
  const empty = !audience.summary && audience.countries.length + audience.ages.length + audience.genders.length === 0;
  return {
    blocks: form.blocks,
    accent: form.accent,
    indexable: form.indexable,
    showPrices: form.showPrices,
    featured: form.featured.filter((item) => item.brand.trim().length > 0),
    declaredAudience: empty ? null : audience,
  };
}

function rowsToSlices(rows: SliceRow[]) {
  return rows.flatMap((row) => {
    const label = row.label.trim();
    const percent = Number(row.percent);
    if (!label || !Number.isFinite(percent) || percent < 0 || percent > 100) return [];
    return [{ label, share: percent / 100 }];
  });
}
