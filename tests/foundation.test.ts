import { describe, expect, it } from "vitest";
import { encryptString, decryptString } from "../src/lib/crypto";
import { createSessionToken, verifySessionToken } from "../src/lib/session";
import { parseCommand } from "../src/modules/reminders/commands";
import { canSendWhatsApp, isQuietHours } from "../src/modules/reminders/policy";
import { displayPaymentStatus } from "../src/modules/crm/status";
import { signWhatsappBody, verifyWhatsappSignature } from "../src/integrations/whatsapp/signature";
import { getInstagramAdapter, getTikTokAdapter, getWhatsAppAdapter } from "../src/integrations";
import { functions } from "../src/jobs/functions";

describe("sesión y cifrado", () => {
  it("firma y rechaza un token vencido", async () => {
    const token = await createSessionToken("11111111-1111-4111-8111-111111111111", Date.parse("2026-01-01T00:00:00Z"));
    expect((await verifySessionToken(token, Date.parse("2026-01-02T00:00:00Z")))?.sub).toBe("11111111-1111-4111-8111-111111111111");
    expect(await verifySessionToken(token, Date.parse("2026-03-15T00:00:00Z"))).toBeNull();
    expect(await verifySessionToken(`${token}x`)).toBeNull();
  });

  it("cifra tokens de redes de ida y vuelta", () => {
    const encrypted = encryptString("token-secreto");
    expect(encrypted.startsWith("v1.")).toBe(true);
    expect(encrypted).not.toContain("token-secreto");
    expect(decryptString(encrypted)).toBe("token-secreto");
  });
});

describe("bot y recordatorios", () => {
  it("entiende los comandos del spec", () => {
    expect(parseCommand("ayuda")).toEqual({ type: "help" });
    expect(parseCommand("BAJA")).toEqual({ type: "unsubscribe" });
    expect(parseCommand("semana")).toEqual({ type: "week" });
    expect(parseCommand("cobré Café Nube")).toEqual({ type: "mark_paid", brand: "Café Nube" });
    expect(parseCommand("nuevo Café Nube 8000 MXN")).toMatchObject({
      type: "new_deal",
      brand: "Café Nube",
      currency: "MXN",
      amountMinor: 800_000n,
    });
    expect(parseCommand("hola, te escribo de la marca")).toMatchObject({ type: "unparsed" });
    expect(parseCommand("   ")).toBeNull();
  });

  it("respeta horario silencioso y el tope diario en Argentina", () => {
    const zone = "America/Argentina/Buenos_Aires";
    expect(isQuietHours(new Date("2026-06-15T13:00:00Z"), zone)).toBe(false);
    expect(isQuietHours(new Date("2026-06-15T01:00:00Z"), zone)).toBe(true);
    expect(isQuietHours(new Date("2026-06-15T11:00:00Z"), zone)).toBe(false);
    expect(canSendWhatsApp({ now: new Date("2026-06-15T13:00:00Z"), timeZone: zone, sentToday: 3 })).toEqual({
      ok: false,
      reason: "daily_cap",
    });
    expect(canSendWhatsApp({ now: new Date("2026-06-15T01:00:00Z"), timeZone: zone, sentToday: 0 })).toEqual({
      ok: false,
      reason: "quiet_hours",
    });
  });

  it("deriva vencido si la fecha ya pasó y el job todavía no corrió", () => {
    expect(displayPaymentStatus("pending", "2026-01-01", "2026-01-02")).toBe("overdue");
    expect(displayPaymentStatus("paid", "2026-01-01", "2026-01-02")).toBe("paid");
  });
});

describe("adaptadores", () => {
  it("verifica la firma de WhatsApp y arma URLs de OAuth mock", () => {
    const body = JSON.stringify({ entry: [] });
    const header = signWhatsappBody("test-whatsapp-secret", body);
    expect(verifyWhatsappSignature("test-whatsapp-secret", body, header)).toBe(true);
    expect(verifyWhatsappSignature("test-whatsapp-secret", body, "sha256=no")).toBe(false);
    const challenge = getWhatsAppAdapter().verifySubscription(
      new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "dev-verify-token", "hub.challenge": "123" }),
    );
    expect(challenge).toBe("123");
    expect(getInstagramAdapter().getAuthorizationUrl({ state: "s", redirectUri: "http://localhost/callback" })).toContain("instagram.com");
    expect(
      getTikTokAdapter().getAuthorizationUrl({ state: "s", redirectUri: "http://localhost/callback", codeChallenge: "abc" }),
    ).toContain("tiktok.com");
  });

  it("registra los jobs del spec", () => {
    expect(functions.map((job) => job.id())).toEqual([
      "reminders.schedule",
      "reminders.dispatch",
      "payments.mark-overdue",
      "digest.weekly",
      "social.sync-daily",
      "social.refresh-tokens",
      "account.hard-delete",
    ]);
  });
});
