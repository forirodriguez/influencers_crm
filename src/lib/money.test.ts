import { describe, expect, it } from "vitest";
import { formatMoney, majorToMinor, MoneyError } from "./money";

describe("money", () => {
  it("guarda pesos, dólares y pesos colombianos en centavos", () => {
    expect(majorToMinor("450000", "ARS")).toBe(45_000_000n);
    expect(majorToMinor("450000,50", "ARS")).toBe(45_000_050n);
    expect(majorToMinor("400", "USD")).toBe(40_000n);
    expect(majorToMinor("1800000", "COP")).toBe(180_000_000n);
  });

  it("rechaza separadores de miles y monedas desconocidas", () => {
    expect(() => majorToMinor("450.000", "ARS")).toThrow(MoneyError);
    expect(() => majorToMinor("-1", "ARS")).toThrow(MoneyError);
    expect(() => majorToMinor("10", "BRL")).toThrow(MoneyError);
  });

  it("muestra el código de moneda y COP sin decimales", () => {
    expect(formatMoney(45_000_000n, "ARS", "es-AR")).toContain("ARS");
    expect(formatMoney(45_000_000n, "ARS", "es-AR")).toContain("450");
    const cop = formatMoney(180_000_050n, "COP", "es-CO");
    expect(cop).toContain("COP");
    expect(cop).not.toMatch(/,\d{2}\b/);
  });
});
