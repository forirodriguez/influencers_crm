import { describe, expect, it } from "vitest";
import { normalizeName } from "./names";
import { isReservedSlug, slugify } from "./slug";
import { toE164 } from "./phone";

describe("nombres y teléfonos", () => {
  it("normaliza marcas con acentos y espacios", () => {
    expect(normalizeName("  Brúma   Belleza ")).toBe("bruma belleza");
    expect(normalizeName("Café Nube")).toBe("cafe nube");
  });

  it("arma slugs y reserva rutas de la app", () => {
    expect(slugify("Cami Gómez")).toBe("cami-gomez");
    expect(isReservedSlug("hoy")).toBe(true);
  });

  it("pasa teléfonos de Latam a E.164", () => {
    expect(toE164("+54 9 11 1234 5678")).toBe("+5491112345678");
    expect(toE164("no es un teléfono")).toBeNull();
  });
});
