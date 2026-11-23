import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { RegisterForm } from "../../../components/auth-forms";

export default async function RegisterPage() {
  const t = await getTranslations();
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
        <h1 className="mt-8 font-display text-5xl">{t("auth.registerTitle")}</h1>
        <p className="mt-4 text-muted">
          {t("auth.hasAccount")}{" "}
          <Link href="/login" className="text-clay underline">
            {t("auth.submitLogin")}
          </Link>
        </p>
      </div>
      <section className="rounded-3xl border border-line bg-card p-6">
        <RegisterForm copy={copy} />
      </section>
    </main>
  );
}
