import { ACTIVE_LOCALE, type AppLocale } from "../lib/constants";
import esUY from "./messages/es-UY/common.json";
import crmUY from "./messages/es-UY/crm.json";
import mediaKitUY from "./messages/es-UY/media-kit.json";

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

/** The product speaks Uruguayan Spanish. Other codes stay in the type so a catalog can be added later; they do not change the voice. */
export function resolveLocale(value?: string | null): AppLocale {
  if (value === ACTIVE_LOCALE) return ACTIVE_LOCALE;
  return ACTIVE_LOCALE;
}

export function loadMessages(locale?: string): Messages {
  const catalog = deepMerge(deepMerge(esUY, crmUY), mediaKitUY);
  if (locale && locale !== ACTIVE_LOCALE) return catalog;
  return catalog;
}
