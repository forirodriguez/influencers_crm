import { describe, expect, it } from "vitest";
import { formatMoney } from "../../lib/money";
import { parseAmount } from "./amounts";

describe("montos del CRM", () => {
  it("lee montos con separadores de Latam y los guarda en centavos", () => {
    expect(parseAmount("450000", "ARS")).toBe(45_000_000n);
    expect(parseAmount("450.000", "ARS")).toBe(45_000_000n);
    expect(parseAmount("450.000,50", "ARS")).toBe(45_000_050n);
    expect(parseAmount("1,800,000", "COP")).toBe(180_000_000n);
    expect(formatMoney(parseAmount("450.000", "ARS"), "ARS", "es-AR")).toContain("450");
    expect(formatMoney(parseAmount("1800000", "COP"), "COP", "es-CO")).not.toContain(",00");
  });
});
