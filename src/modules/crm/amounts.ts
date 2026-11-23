import { majorToMinor } from "../../lib/money";

/** Acepta "450000", "450000,50", "450.000" y "450.000,50". */
export function parseAmount(amount: string, currency: string): bigint {
  const trimmed = amount.trim();
  let normalized = trimmed;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(trimmed)) {
    normalized = trimmed.replaceAll(".", "").replace(",", ".");
  } else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(trimmed)) {
    normalized = trimmed.replaceAll(",", "");
  }
  return majorToMinor(normalized, currency);
}
