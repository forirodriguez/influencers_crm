import { describe, expect, it } from "vitest";
import { formatWallInput, parseUserDateTime } from "./wall-time";

describe("fechas en la zona del usuario", () => {
  it("guarda las 15:00 de Buenos Aires como las 18:00 UTC", () => {
    const date = parseUserDateTime("2026-12-01T15:00", "America/Argentina/Buenos_Aires");
    expect(date.toISOString()).toBe("2026-12-01T18:00:00.000Z");
    expect(formatWallInput(date, "America/Argentina/Buenos_Aires")).toBe("2026-12-01T15:00");
  });

  it("respeta un instante que ya viene en UTC", () => {
    const date = parseUserDateTime("2026-12-01T18:00:00.000Z", "America/Mexico_City");
    expect(formatWallInput(date, "America/Mexico_City")).toBe("2026-12-01T12:00");
  });
});
