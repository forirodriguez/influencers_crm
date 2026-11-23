"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui/button";
import { Input, Label, Select } from "./ui/input";

type Copy = {
  name: string;
  email: string;
  password: string;
  country: string;
  timezone: string;
  termsPrefix: string;
  terms: string;
  privacy: string;
  submitLogin: string;
  submitRegister: string;
  useMagic: string;
  usePassword: string;
  sendLink: string;
  magicHelp: string;
  countryAR: string;
  countryMX: string;
  countryCO: string;
  countryUY: string;
  countryOther: string;
  errorGeneric: string;
};

const countries = [
  ["UY", "countryUY"],
  ["AR", "countryAR"],
  ["MX", "countryMX"],
  ["CO", "countryCO"],
  ["OTHER", "countryOther"],
] as const;

export function LoginForm({ copy }: { copy: Copy }) {
  const [magic, setMagic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setDevLink(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch(magic ? "/api/v1/auth/magic-link" : "/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    const body = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(body.error?.message ?? copy.errorGeneric);
      return;
    }
    if (body.data?.devLink) {
      setDevLink(body.data.devLink);
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next");
    router.push(body.data?.needsOnboarding ? "/onboarding" : next && next.startsWith("/") ? next : "/hoy");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email">{copy.email}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      {magic ? <p className="text-sm text-muted">{copy.magicHelp}</p> : (
        <div>
          <Label htmlFor="password">{copy.password}</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} />
        </div>
      )}
      {error ? <p className="text-sm text-clay">{error}</p> : null}
      {devLink ? (
        <a className="block break-all text-sm text-moss underline" href={devLink}>
          {devLink}
        </a>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {magic ? copy.sendLink : copy.submitLogin}
      </Button>
      <button type="button" className="text-sm text-muted underline" onClick={() => setMagic((value) => !value)}>
        {magic ? copy.usePassword : copy.useMagic}
      </button>
    </form>
  );
}

export function RegisterForm({ copy }: { copy: Copy }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [country, setCountry] = useState("UY");
  const router = useRouter();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        country: form.get("country"),
        timezone: form.get("timezone") || undefined,
        acceptTerms: form.get("acceptTerms") === "on",
      }),
    });
    const body = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(body.error?.message ?? copy.errorGeneric);
      return;
    }
    router.push("/hoy");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">{copy.name}</Label>
        <Input id="name" name="name" autoComplete="name" required minLength={2} />
      </div>
      <div>
        <Label htmlFor="email">{copy.email}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <Label htmlFor="password">{copy.password}</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      <div>
        <Label htmlFor="country">{copy.country}</Label>
        <Select id="country" name="country" value={country} onChange={(event) => setCountry(event.target.value)}>
          {countries.map(([code, key]) => (
            <option key={code} value={code}>
              {copy[key]}
            </option>
          ))}
        </Select>
      </div>
      {country === "MX" ? (
        <div>
          <Label htmlFor="timezone">{copy.timezone}</Label>
          <Select id="timezone" name="timezone" defaultValue="America/Mexico_City">
            <option value="America/Mexico_City">Ciudad de México</option>
            <option value="America/Cancun">Cancún</option>
            <option value="America/Mazatlan">Mazatlán</option>
            <option value="America/Tijuana">Tijuana</option>
            <option value="America/Hermosillo">Hermosillo</option>
            <option value="America/Chihuahua">Chihuahua</option>
            <option value="America/Monterrey">Monterrey</option>
          </Select>
        </div>
      ) : null}
      <label className="flex items-start gap-2 text-sm">
        <input name="acceptTerms" type="checkbox" required className="mt-1" />
        <span>
          {copy.termsPrefix} <Link className="underline" href="/legales/terminos">{copy.terms}</Link> y la{" "}
          <Link className="underline" href="/legales/privacidad">{copy.privacy}</Link>.
        </span>
      </label>
      {error ? <p className="text-sm text-clay">{error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full">
        {copy.submitRegister}
      </Button>
    </form>
  );
}
