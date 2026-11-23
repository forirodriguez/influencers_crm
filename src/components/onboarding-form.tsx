"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui/button";
import { Label, Select } from "./ui/input";

type Copy = {
  title: string;
  body: string;
  country: string;
  timezone: string;
  submit: string;
  countryAR: string;
  countryMX: string;
  countryCO: string;
  countryUY: string;
  countryOther: string;
  errorGeneric: string;
};

export function OnboardingForm({ copy }: { copy: Copy }) {
  const [country, setCountry] = useState("AR");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/me/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ country: form.get("country"), timezone: form.get("timezone") || undefined }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error?.message ?? copy.errorGeneric);
      return;
    }
    router.push("/hoy");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <div>
        <Label htmlFor="country">{copy.country}</Label>
        <Select id="country" name="country" value={country} onChange={(event) => setCountry(event.target.value)}>
          <option value="AR">{copy.countryAR}</option>
          <option value="MX">{copy.countryMX}</option>
          <option value="CO">{copy.countryCO}</option>
          <option value="UY">{copy.countryUY}</option>
          <option value="OTHER">{copy.countryOther}</option>
        </Select>
      </div>
      {country === "MX" ? (
        <div>
          <Label htmlFor="timezone">{copy.timezone}</Label>
          <Select id="timezone" name="timezone" defaultValue="America/Mexico_City">
            <option value="America/Mexico_City">Ciudad de México</option>
            <option value="America/Cancun">Cancún</option>
            <option value="America/Tijuana">Tijuana</option>
            <option value="America/Monterrey">Monterrey</option>
          </Select>
        </div>
      ) : null}
      {error ? <p className="text-sm text-clay">{error}</p> : null}
      <Button type="submit">{copy.submit}</Button>
    </form>
  );
}
