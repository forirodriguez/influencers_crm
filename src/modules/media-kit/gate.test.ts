import { describe, expect, it } from "vitest";
import { canManualSync, demographicsForStorage, shouldSkipDailySync, tokenDue, INSTAGRAM_REFRESH_WINDOW_MS } from "./gate";
import { normalizeSettings } from "./settings";

describe("media kit gates", () => {
  it("limita el botón de actualizar a una vez por hora", () => {
    const now = new Date("2026-11-23T15:00:00Z");
    expect(canManualSync(null, now)).toEqual({ ok: true });
    const recent = canManualSync(new Date("2026-11-23T14:30:00Z"), now);
    expect(recent.ok).toBe(false);
    expect(canManualSync(new Date("2026-11-23T13:00:00Z"), now)).toEqual({ ok: true });
    expect(shouldSkipDailySync(new Date("2026-11-23T10:00:00Z"), now)).toBe(true);
    expect(shouldSkipDailySync(new Date("2026-11-22T10:00:00Z"), now)).toBe(false);
  });

  it("no guarda demografía bajo 100 seguidores y normaliza settings viejos", () => {
    expect(demographicsForStorage(40, { countries: [{ label: "AR", share: 1 }] })).toBeNull();
    expect(demographicsForStorage(100, { countries: [] })).toEqual({ countries: [] });
    const settings = normalizeSettings({
      blocks: { photo: true, bio: false, metrics: true, services: true, contact: true },
      accent: "#112233",
      showPrices: true,
    });
    expect(settings.blocks.bio).toBe(false);
    expect(settings.blocks.audience).toBe(true);
    expect(settings.blocks.featured).toBe(true);
    expect(settings.featured).toEqual([]);
    expect(settings.accent).toBe("#112233");
    expect(tokenDue(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), new Date(), INSTAGRAM_REFRESH_WINDOW_MS, 24 * 60 * 60 * 1000)).toBe(true);
    expect(tokenDue(null, new Date(), INSTAGRAM_REFRESH_WINDOW_MS, 1000)).toBe(false);
  });
});
