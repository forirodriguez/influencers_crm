"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function FollowUp({
  text,
  subject,
  phone,
  email,
}: {
  text: string;
  subject: string;
  phone: string | null;
  email: string | null;
}) {
  const t = useTranslations("crm");
  const [body, setBody] = useState(text);
  const digits = phone?.replace(/\D/g, "") ?? "";
  const href = digits.length >= 8
    ? `https://wa.me/${digits}?text=${encodeURIComponent(body)}`
    : email
      ? `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      : null;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t("followUp")}</p>
      <textarea
        className="min-h-28 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        aria-label={t("followUp")}
      />
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-full bg-moss px-4 py-2 text-sm font-medium text-white">
          {digits.length >= 8 ? t("openWhatsapp") : t("followUpEmail")}
        </a>
      ) : (
        <p className="text-sm text-muted">{t("followUpMissing")}</p>
      )}
      <p className="text-xs text-muted">{t("followUpHelp")}</p>
    </div>
  );
}
