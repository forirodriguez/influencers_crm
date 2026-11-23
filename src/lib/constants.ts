export const CURRENCIES = ["ARS", "MXN", "COP", "UYU", "USD"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

export const LOCALES = ["es-AR", "es-UY", "es-MX", "es-CO"] as const;
export type AppLocale = (typeof LOCALES)[number];

export const LEGAL_VERSION = "2026-11-23";
export const WHATSAPP_CONSENT_VERSION = "2026-11-23";
export const MAX_WHATSAPP_PER_USER_PER_DAY = 3;
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export const COUNTRY_PRESETS = {
  AR: { currency: "ARS" as const, timezone: "America/Argentina/Buenos_Aires", locale: "es-AR" as const },
  MX: { currency: "MXN" as const, timezone: "America/Mexico_City", locale: "es-MX" as const },
  CO: { currency: "COP" as const, timezone: "America/Bogota", locale: "es-CO" as const },
  UY: { currency: "UYU" as const, timezone: "America/Montevideo", locale: "es-UY" as const },
  OTHER: { currency: "USD" as const, timezone: "UTC", locale: "es-AR" as const },
};

export const MX_TIMEZONES = [
  "America/Mexico_City",
  "America/Cancun",
  "America/Mazatlan",
  "America/Tijuana",
  "America/Hermosillo",
  "America/Chihuahua",
  "America/Monterrey",
] as const;

export function isCurrency(value: string): value is CurrencyCode {
  return (CURRENCIES as readonly string[]).includes(value);
}

export function isLocale(value: string): value is AppLocale {
  return (LOCALES as readonly string[]).includes(value);
}
