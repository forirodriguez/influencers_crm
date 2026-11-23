import { CURRENCIES, type CurrencyCode, isCurrency } from "./constants";

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

/** Convierte un decimal sin separador de miles ("450000" o "450000,50") a unidades menores. */
export function majorToMinor(amount: string, currency: string): bigint {
  if (!isCurrency(currency)) throw new MoneyError(`Moneda no soportada: ${currency}`);
  const normalized = amount.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new MoneyError("El monto tiene que ser un número positivo con hasta 2 decimales, sin separador de miles");
  }
  const [whole, fraction = ""] = normalized.split(".");
  const cents = `${fraction}00`.slice(0, 2);
  return BigInt(whole) * 100n + BigInt(cents);
}

export function formatMoney(amountMinor: bigint | string | number, currency: string, locale = "es-UY"): string {
  const code = isCurrency(currency) ? currency : "USD";
  const minor = typeof amountMinor === "bigint" ? amountMinor : BigInt(amountMinor);
  const negative = minor < 0n;
  const absolute = negative ? -minor : minor;
  const hideDecimals = code === "COP";
  const major = hideDecimals ? Number((absolute + 50n) / 100n) : Number(absolute) / 100;
  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    currencyDisplay: "code",
    minimumFractionDigits: hideDecimals || absolute % 100n === 0n ? 0 : 2,
    maximumFractionDigits: hideDecimals ? 0 : 2,
  }).format(negative ? -major : major);
  return formatted;
}

export function groupByCurrency<T extends { currency: string; amountMinor: bigint }>(rows: T[]): Map<string, bigint> {
  const totals = new Map<string, bigint>();
  for (const row of rows) {
    totals.set(row.currency, (totals.get(row.currency) ?? 0n) + row.amountMinor);
  }
  return totals;
}

export const SUPPORTED_CURRENCIES: readonly CurrencyCode[] = CURRENCIES;
