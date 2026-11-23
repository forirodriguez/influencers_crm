import { isLocale, type AppLocale } from "../lib/constants";
import esAR from "./messages/es-AR/common.json";
import mediaKitAR from "./messages/es-AR/media-kit.json";
import esMX from "./messages/es-MX/common.json";
import mediaKitMX from "./messages/es-MX/media-kit.json";

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
  const base = locale === "es-MX" || locale === "es-CO" ? deepMerge(esAR, esMX) : esAR;
  const mediaKit = locale === "es-MX" || locale === "es-CO" ? deepMerge(mediaKitAR, mediaKitMX) : mediaKitAR;
  return deepMerge(base, mediaKit);
}
