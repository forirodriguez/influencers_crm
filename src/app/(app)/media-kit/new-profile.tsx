"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";

export function NewProfileForm() {
  const t = useTranslations("mediaKit");
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-4 flex flex-wrap gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        const response = await fetch("/api/v1/creator-profiles", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ displayName: name }),
        });
        const payload = (await response.json()) as { data?: { id?: string }; error?: { message?: string } };
        if (!response.ok || !payload.data?.id) {
          setError(payload.error?.message ?? t("banners.oauth_failed"));
          return;
        }
        setName("");
        router.push(`/media-kit?profile=${payload.data.id}`);
        router.refresh();
      }}
    >
      <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("newProfile")} aria-label={t("newProfile")} className="max-w-xs" />
      <Button type="submit" variant="secondary">
        {t("createProfile")}
      </Button>
      {error ? <p className="w-full text-sm">{error}</p> : null}
    </form>
  );
}
