"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { sendJson, textValue } from "./client";
import { Button, ErrorNote, Field, Input, TextArea } from "./fields";

export function BrandForm({
  brandId,
  initial,
}: {
  brandId?: string;
  initial?: {
    name: string;
    website: string;
    instagram: string;
    tiktok: string;
    industry: string;
    country: string;
    notes: string;
  };
}) {
  const t = useTranslations("crm");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const body = {
      name: textValue(form, "name"),
      website: textValue(form, "website"),
      instagram: textValue(form, "instagram"),
      tiktok: textValue(form, "tiktok"),
      industry: textValue(form, "industry"),
      country: textValue(form, "country"),
      notes: textValue(form, "notes"),
    };
    try {
      const data = await sendJson(brandId ? `/api/v1/brands/${brandId}` : "/api/v1/brands", brandId ? "PATCH" : "POST", body);
      const id = brandId ?? (typeof data.brand === "object" && data.brand && "id" in data.brand ? String((data.brand as { id: string }).id) : "");
      router.push(id ? `/marcas/${id}` : "/marcas");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("save"));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><ErrorNote message={error} /></div>
      <Field label={t("brandName")}><Input name="name" required defaultValue={initial?.name} /></Field>
      <Field label={t("industry")}><Input name="industry" defaultValue={initial?.industry} /></Field>
      <Field label={t("website")}><Input name="website" defaultValue={initial?.website} /></Field>
      <Field label={t("country")}><Input name="country" defaultValue={initial?.country} /></Field>
      <Field label={t("instagram")}><Input name="instagram" defaultValue={initial?.instagram} /></Field>
      <Field label={t("tiktok")}><Input name="tiktok" defaultValue={initial?.tiktok} /></Field>
      <div className="sm:col-span-2">
        <Field label={t("notes")}><TextArea name="notes" defaultValue={initial?.notes} /></Field>
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">{t("save")}</Button>
    </form>
  );
}

export function ContactForm({ brandId }: { brandId: string }) {
  const t = useTranslations("crm");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await sendJson(`/api/v1/brands/${brandId}/contacts`, "POST", {
        name: textValue(form, "name"),
        role: textValue(form, "role"),
        email: textValue(form, "email"),
        whatsapp: textValue(form, "whatsapp"),
        instagram: textValue(form, "instagram"),
        notes: textValue(form, "notes"),
      });
      event.currentTarget.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("save"));
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><ErrorNote message={error} /></div>
      <Field label={t("contactName")}><Input name="name" required /></Field>
      <Field label={t("role")}><Input name="role" /></Field>
      <Field label={t("email")}><Input name="email" type="email" /></Field>
      <Field label={t("whatsapp")}><Input name="whatsapp" placeholder="+54911..." /></Field>
      <Field label={t("instagram")}><Input name="instagram" /></Field>
      <div className="sm:col-span-2">
        <Button type="submit" className="w-full sm:w-auto">{t("addContact")}</Button>
      </div>
    </form>
  );
}

export function DeleteResource({ url, redirectTo }: { url: string; redirectTo: string }) {
  const t = useTranslations("crm");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <ErrorNote message={error} />
      <button
        type="button"
        className="text-sm text-clay"
        onClick={async () => {
          if (!window.confirm(t("deleteConfirm"))) return;
          try {
            await sendJson(url, "DELETE");
            router.push(redirectTo);
            router.refresh();
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : t("save"));
          }
        }}
      >
        {t("delete")}
      </button>
    </div>
  );
}
