import { isCurrency, type CurrencyCode } from "../../lib/constants";
import { majorToMinor } from "../../lib/money";

export type BotCommand =
  | { type: "help" }
  | { type: "unsubscribe" }
  | { type: "week" }
  | { type: "mark_paid"; brand: string }
  | { type: "new_deal"; brand: string; amountMinor: bigint; currency: CurrencyCode }
  | { type: "unparsed"; text: string };

export function parseCommand(input: string): BotCommand | null {
  const text = input.replace(/\s+/g, " ").trim();
  if (!text) return null;
  const normalized = text.toLowerCase();
  if (normalized === "ayuda" || normalized === "help") return { type: "help" };
  if (normalized === "baja" || normalized === "stop") return { type: "unsubscribe" };
  if (normalized === "semana" || normalized === "week") return { type: "week" };

  const paid = text.match(/^cobr[eé]\s+(.+)$/i);
  if (paid?.[1]) return { type: "mark_paid", brand: paid[1].trim() };

  const created = text.match(/^nuevo\s+(.+)$/i);
  if (created?.[1]) {
    const parts = created[1].trim().split(" ");
    if (parts.length >= 3) {
      const currency = parts[parts.length - 1]?.toUpperCase() ?? "";
      const amount = parts[parts.length - 2] ?? "";
      const brand = parts.slice(0, -2).join(" ").trim();
      if (brand && isCurrency(currency)) {
        try {
          return { type: "new_deal", brand, amountMinor: majorToMinor(amount, currency), currency };
        } catch {
          return { type: "unparsed", text };
        }
      }
    }
  }

  return { type: "unparsed", text };
}
