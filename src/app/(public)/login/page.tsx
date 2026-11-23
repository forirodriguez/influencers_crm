import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "../../../components/auth-forms";
import { getEnv } from "../../../lib/env.server";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const t = await getTranslations();
  const params = await searchParams;
  const env = getEnv();
  const error = params.error === "link" ? t("auth.errorLink") : params.error === "google" ? t("auth.errorGoogle") : null;
  const copy = {
    name: t("auth.name"),
    email: t("auth.email"),
    password: t("auth.password"),
    country: t("auth.country"),
    timezone: t("auth.timezone"),
    termsPrefix: t("auth.termsPrefix"),
    terms: t("auth.terms"),
    privacy: t("auth.privacy"),
    submitLogin: t("auth.submitLogin"),
    submitRegister: t("auth.submitRegister"),
    useMagic: t("auth.useMagic"),
    usePassword: t("auth.usePassword"),
    sendLink: t("auth.sendLink"),
    magicHelp: t("auth.magicHelp"),
    countryAR: t("auth.countryAR"),
    countryMX: t("auth.countryMX"),
    countryCO: t("auth.countryCO"),
    countryUY: t("auth.countryUY"),
    countryOther: t("auth.countryOther"),
    errorGeneric: t("auth.errorGeneric"),
  };
  return (
    <main className="mx-auto grid min-h-screen max-w-5xl items-center gap-10 px-5 py-10 md:grid-cols-2">
      <div>
        <Link href="/" className="font-display text-3xl">
          {t("common.appName")}
        </Link>
        <h1 className="mt-8 font-display text-5xl">{t("auth.loginTitle")}</h1>
        <p className="mt-4 text-muted">
          {t("auth.noAccount")}{" "}
          <Link href="/registro" className="text-clay underline">
            {t("auth.submitRegister")}
          </Link>
        </p>
      </div>
      <section className="rounded-3xl border border-line bg-card p-6">
        {error ? <p className="mb-4 text-sm text-clay">{error}</p> : null}
        <LoginForm copy={copy} />
        <form action="/api/v1/auth/google" method="get" className="mt-4 text-center">
          <button type="submit" className="text-sm underline">
            {t("auth.google")}
          </button>
        </form>
        <p className="mt-2 text-center text-xs text-muted">{t("auth.googleMissing")}</p>
        {env.AUTH_DEV_EXPOSE_LINKS === "true" ? (
          <div className="mt-6 rounded-2xl bg-sand p-4 text-sm">
            <p className="font-medium">{t("auth.demoTitle")}</p>
            <p>cami@demo.influencerscrm.test</p>
            <p>diego@demo.influencerscrm.test</p>
            <p>valen@demo.influencerscrm.test</p>
            <p>nati@demo.influencerscrm.test</p>
            <p className="mt-2 text-muted">{t("auth.demoPassword")}</p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
