import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getAppContext } from "../../modules/identity/context";

export default async function LandingPage() {
  const t = await getTranslations();
  const session = await getAppContext();
  return (
    <main className="mx-auto max-w-6xl px-5 py-6">
      <header className="flex items-center justify-between">
        <p className="font-display text-2xl">{t("common.appName")}</p>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-full bg-sand px-2 py-1 text-xs uppercase tracking-wide">{t("common.beta")}</span>
          <Link href={session ? "/hoy" : "/login"} className="underline">
            {session ? t("landing.enter") : t("landing.login")}
          </Link>
        </div>
      </header>
      <section className="mt-16 grid items-end gap-10 md:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="text-sm text-muted">{t("landing.eyebrow")}</p>
          <h1 className="mt-3 max-w-xl font-display text-5xl leading-[1.05] md:text-6xl">{t("landing.title")}</h1>
          <p className="mt-5 max-w-lg text-lg text-muted">{t("landing.subtitle")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/registro" className="rounded-full bg-clay px-5 py-3 text-sm text-white">
              {t("landing.cta")}
            </Link>
            <Link href="/login" className="rounded-full border border-line bg-card px-5 py-3 text-sm">
              {t("landing.login")}
            </Link>
          </div>
        </div>
        <article className="rounded-3xl border border-line bg-card p-6 shadow-[8px_12px_0_#241c18]">
          <p className="text-xs uppercase tracking-wide text-muted">{t("landing.sampleKicker")}</p>
          <h2 className="mt-3 font-display text-3xl">{t("landing.sampleTitle")}</h2>
          <p className="mt-2 text-sm">{t("landing.sampleBrand")}</p>
          <p className="mt-6 text-sm text-muted">{t("landing.sampleMeta")}</p>
        </article>
      </section>
      <section className="mt-16 grid gap-4 md:grid-cols-3">
        {[
          [t("landing.point1Title"), t("landing.point1Body")],
          [t("landing.point2Title"), t("landing.point2Body")],
          [t("landing.point3Title"), t("landing.point3Body")],
        ].map(([title, body]) => (
          <article key={title} className="rounded-2xl bg-sand p-5">
            <h3 className="font-display text-2xl">{title}</h3>
            <p className="mt-2 text-sm text-muted">{body}</p>
          </article>
        ))}
      </section>
      <p className="mt-12 max-w-2xl text-sm text-muted">{t("landing.note")}</p>
    </main>
  );
}
