"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { sendJson, textValue } from "./client";
import { Button, ErrorNote, Field, Input, Select, TextArea } from "./fields";

type Option = { id: string; name: string };
type Stage = Option & { kind: string };

const compensations = ["paid", "barter", "mixed", "affiliate"] as const;
const sources = ["", "ig_dm", "tiktok_dm", "email", "whatsapp", "referral", "other"] as const;
const platforms = ["instagram", "tiktok", "other"] as const;
const formats = ["reel", "story", "post", "video", "ugc"] as const;

export function DealForm({
  brands,
  profiles,
  stages,
  contactsByBrand,
  currencies,
  defaultCurrency,
}: {
  brands: Option[];
  profiles: Option[];
  stages: Stage[];
  contactsByBrand: Record<string, Option[]>;
  currencies: string[];
  defaultCurrency: string;
}) {
  const t = useTranslations("crm");
  const labels = useTranslations("labels");
  const router = useRouter();
  const [brandMode, setBrandMode] = useState(brands.length > 0 ? "existing" : "new");
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [compensation, setCompensation] = useState<(typeof compensations)[number]>("paid");
  const [stageId, setStageId] = useState(stages[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const stage = stages.find((item) => item.id === stageId);
  const contacts = contactsByBrand[brandId] ?? [];
  const showMoney = compensation === "paid" || compensation === "mixed" || compensation === "affiliate";
  const showBarter = compensation === "barter" || compensation === "mixed";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {
      title: textValue(form, "title"),
      compensationType: compensation,
      creatorProfileId: textValue(form, "creatorProfileId") || undefined,
      stageId,
      source: textValue(form, "source") || null,
      expectedCloseDate: textValue(form, "expectedCloseDate") || null,
      notes: textValue(form, "notes") || null,
      exclusivityCategory: textValue(form, "exclusivityCategory") || null,
      exclusivityUntil: textValue(form, "exclusivityUntil") || null,
      lostReason: textValue(form, "lostReason") || null,
      draftDueAt: textValue(form, "draftDueAt") || null,
      approvalDueAt: textValue(form, "approvalDueAt") || null,
      publishDueAt: textValue(form, "publishDueAt") || null,
      deliverablePlatform: textValue(form, "platform") || "instagram",
      deliverableFormat: textValue(form, "format") || "reel",
      deliverableQuantity: textValue(form, "quantity") || undefined,
      paymentDueDate: textValue(form, "paymentDueDate") || null,
    };
    if (brandMode === "new") body.brandName = textValue(form, "brandName");
    else {
      body.brandId = brandId;
      body.primaryContactId = textValue(form, "primaryContactId") || null;
    }
    if (showMoney) {
      body.amount = textValue(form, "amount") || null;
      body.currency = textValue(form, "currency") || defaultCurrency;
    }
    if (showBarter) {
      body.barterValue = textValue(form, "barterValue") || null;
      body.barterCurrency = textValue(form, "barterCurrency") || defaultCurrency;
    }
    try {
      const data = await sendJson("/api/v1/deals", "POST", body);
      const id = typeof data.id === "string" ? data.id : "";
      router.push(id ? `/acuerdos/${id}` : "/pipeline");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("save"));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <ErrorNote message={error} />
      <Field label={t("title")}>
        <Input name="title" required maxLength={160} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("brand")}>
          <Select value={brandMode} onChange={(event) => setBrandMode(event.target.value)}>
            {brands.length > 0 ? <option value="existing">{t("existingBrand")}</option> : null}
            <option value="new">{t("newBrandInline")}</option>
          </Select>
        </Field>
        {brandMode === "new" ? (
          <Field label={t("brandName")}>
            <Input name="brandName" required />
          </Field>
        ) : (
          <Field label={t("brandName")}>
            <Select name="brandId" value={brandId} onChange={(event) => setBrandId(event.target.value)}>
              {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </Select>
          </Field>
        )}
      </div>
      {brandMode === "existing" && contacts.length > 0 ? (
        <Field label={t("contact")}>
          <Select name="primaryContactId" defaultValue="">
            <option value="">{t("noneContact")}</option>
            {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
          </Select>
        </Field>
      ) : null}
      {profiles.length > 1 ? (
        <Field label={t("profile")}>
          <Select name="creatorProfileId" defaultValue={profiles[0]?.id}>
            {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
          </Select>
        </Field>
      ) : (
        <input type="hidden" name="creatorProfileId" value={profiles[0]?.id ?? ""} />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("stage")}>
          <Select value={stageId} onChange={(event) => setStageId(event.target.value)}>
            {stages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
        </Field>
        <Field label={t("compensation")}>
          <Select value={compensation} onChange={(event) => setCompensation(event.target.value as (typeof compensations)[number])}>
            {compensations.map((item) => (
              <option key={item} value={item}>{t(`compensation${item[0]?.toUpperCase()}${item.slice(1)}`)}</option>
            ))}
          </Select>
        </Field>
      </div>
      {stage?.kind === "lost" ? (
        <Field label={t("lostReason")} hint={t("lostHelp")}>
          <Input name="lostReason" required />
        </Field>
      ) : null}
      {showMoney ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("amount")}>
            <Input name="amount" inputMode="decimal" placeholder="450000" />
          </Field>
          <Field label={t("currency")}>
            <Select name="currency" defaultValue={defaultCurrency}>
              {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </Select>
          </Field>
        </div>
      ) : null}
      {showBarter ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("barterValue")}>
            <Input name="barterValue" inputMode="decimal" />
          </Field>
          <Field label={t("currency")}>
            <Select name="barterCurrency" defaultValue={defaultCurrency}>
              {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </Select>
          </Field>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("closeDate")}>
          <Input name="expectedCloseDate" type="date" />
        </Field>
        <Field label={t("paymentDue")} hint={t("paymentDueHelp")}>
          <Input name="paymentDueDate" type="date" />
        </Field>
      </div>
      <fieldset className="space-y-3 rounded-2xl border border-line p-4">
        <legend className="px-1 text-sm font-medium">{t("firstDelivery")}</legend>
        <p className="text-xs text-muted">{t("firstDeliveryHelp")}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("platform")}>
            <Select name="platform" defaultValue="instagram">
              {platforms.map((item) => <option key={item} value={item}>{t(`platform${item[0]?.toUpperCase()}${item.slice(1)}`)}</option>)}
            </Select>
          </Field>
          <Field label={t("format")}>
            <Select name="format" defaultValue="reel">
              {formats.map((item) => <option key={item} value={item}>{labels(item)}</option>)}
            </Select>
          </Field>
          <Field label={t("quantity")}>
            <Input name="quantity" type="number" min={1} max={99} defaultValue={1} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("draftDue")}><Input name="draftDueAt" type="datetime-local" /></Field>
          <Field label={t("approvalDue")}><Input name="approvalDueAt" type="datetime-local" /></Field>
          <Field label={t("publishDue")}><Input name="publishDueAt" type="datetime-local" /></Field>
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("source")}>
          <Select name="source" defaultValue="">
            <option value="">{t("any")}</option>
            {sources.filter(Boolean).map((item) => (
              <option key={item} value={item}>{sourceLabel(item, t)}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("exclusivityCategory")}>
          <Input name="exclusivityCategory" />
        </Field>
        <Field label={t("exclusivityUntil")}>
          <Input name="exclusivityUntil" type="date" />
        </Field>
      </div>
      <Field label={t("notes")}>
        <TextArea name="notes" />
      </Field>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">{pending ? "…" : t("save")}</Button>
    </form>
  );
}

function sourceLabel(value: string, t: (key: string) => string) {
  const map: Record<string, string> = {
    ig_dm: "sourceIg",
    tiktok_dm: "sourceTiktok",
    email: "sourceEmail",
    whatsapp: "sourceWhatsapp",
    referral: "sourceReferral",
    other: "sourceOther",
  };
  return t(map[value] ?? "sourceOther");
}
