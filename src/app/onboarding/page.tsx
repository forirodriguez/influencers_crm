import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { OnboardingForm } from "../../components/onboarding-form";
import { getAppContext } from "../../modules/identity/context";

export default async function OnboardingPage() {
  const context = await getAppContext();
  if (!context) redirect("/login");
  if (context.user.country) redirect("/hoy");
  const t = await getTranslations();
  return (
    <main className="mx-auto max-w-lg px-5 py-16">
      <p className="font-display text-3xl">{t("common.appName")}</p>
      <h1 className="mt-8 font-display text-4xl">{t("onboarding.title")}</h1>
      <p className="mt-3 text-muted">{t("onboarding.body")}</p>
      <OnboardingForm
        copy={{
          title: t("onboarding.title"),
          body: t("onboarding.body"),
          country: t("auth.country"),
          timezone: t("auth.timezone"),
          submit: t("onboarding.submit"),
          countryAR: t("auth.countryAR"),
          countryMX: t("auth.countryMX"),
          countryCO: t("auth.countryCO"),
          countryUY: t("auth.countryUY"),
          countryOther: t("auth.countryOther"),
          errorGeneric: t("auth.errorGeneric"),
        }}
      />
    </main>
  );
}
