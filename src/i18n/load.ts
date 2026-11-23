import { isLocale, type AppLocale } from "../lib/constants";
import esAR from "./messages/es-AR/common.json";
import crmAR from "./messages/es-AR/crm.json";
import esMX from "./messages/es-MX/common.json";
import crmMX from "./messages/es-MX/crm.json";

type Messages = Record<string, unknown>;

function deepMerge(base: Messages, overlay: Messages): Messages {
  const result: Messages = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const current = result[key];
    if (value && typeof value === "object" && !Array.isArray(value) && current && typeof current === "object" && !Array.isArray(current)) {
      result[key] = deepMerge(current as Messages, value as Messages);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function resolveLocale(value: string | null | undefined): AppLocale {
  if (value && isLocale(value)) return value;
  return "es-AR";
}

export function loadMessages(locale: string): Messages {
  const base = deepMerge(esAR, crmAR);
  if (locale === "es-MX" || locale === "es-CO") return deepMerge(deepMerge(base, esMX), crmMX);
  return base;
}
