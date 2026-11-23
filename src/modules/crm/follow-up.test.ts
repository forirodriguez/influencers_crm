import { describe, expect, it } from "vitest";
import { FOLLOW_UP_TEMPLATE, buildFollowUp, whatsappHref } from "./follow-up";

describe("mensaje para reclamar un cobro", () => {
  it("arma un link de wa.me con el texto y sin factura", () => {
    const result = buildFollowUp({
      who: "Sol",
      title: "Reel serum",
      amount: "ARS 450.000",
      due: "1 dic 2026",
      creator: "Cami",
      brand: "Bruma",
      phoneE164: "+54 9 11 5555-4444",
      email: "sol@bruma.test",
      channel: "whatsapp",
    });
    expect(result.href).toMatch(/^https:\/\/wa\.me\/5491155554444\?text=/);
    expect(decodeURIComponent(result.href ?? "")).toContain("Reel serum");
    expect(result.text).toContain("ARS 450.000");
    expect(result.text.toLowerCase()).not.toContain("factura");
    expect(FOLLOW_UP_TEMPLATE.toLowerCase()).not.toMatch(/factura|cae|cfdi/);
    expect(whatsappHref(null, "hola")).toBeNull();
  });

  it("arma un mailto cuando el canal es email", () => {
    const result = buildFollowUp({
      who: "Sol",
      title: "Reel",
      amount: "USD 400",
      due: "ayer",
      creator: "Cami",
      brand: "Andes",
      email: "hola@andes.test",
      channel: "email",
    });
    expect(result.href).toMatch(/^mailto:hola@andes\.test\?subject=/);
    expect(decodeURIComponent(result.href ?? "")).toContain("Andes");
  });
});