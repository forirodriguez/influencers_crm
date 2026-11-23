import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ProductAnalytics } from "../lib/observability/posthog";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: { default: "influencers_crm", template: "%s · influencers_crm" },
  description: "CRM para microinfluencers de Latam hispanohablante.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={`${outfit.variable} ${fraunces.variable}`}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <ProductAnalytics />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
