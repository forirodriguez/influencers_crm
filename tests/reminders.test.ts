import { afterAll, beforeEach, describe, expect, it } from "vitest";
import postgres from "postgres";
import { asc, eq } from "drizzle-orm";
import { closePools, withAdmin, withUser } from "../src/db/client";
import { truncatePublicTables } from "../src/db/truncate";
import { WHATSAPP_CONSENT_VERSION } from "../src/lib/constants";
import { getLastEmail } from "../src/integrations/email/console";
import { CloudWhatsAppAdapter } from "../src/integrations/whatsapp/cloud";
import { getWhatsAppAdapter } from "../src/integrations";
import { signWhatsappBody } from "../src/integrations/whatsapp/signature";
import { brands, deals, deliverables, paymentExpectations, pipelineStages } from "../src/modules/crm/schema";
import { exportAccount, exportCsv, hardDeleteExpiredAccounts, softDeleteAccount } from "../src/modules/identity/privacy";
import { loginWithPassword, registerWithPassword } from "../src/modules/identity/service";
import { users } from "../src/modules/identity/schema";
import { creatorProfiles, socialAccounts } from "../src/modules/media-kit/schema";
import { executeBotCommand } from "../src/modules/reminders/bot";
import { parseCommand } from "../src/modules/reminders/commands";
import { confirmPhoneVerification, startPhoneVerification } from "../src/modules/reminders/consent";
import { dispatchReminders, sendDigests } from "../src/modules/reminders/engine";
import { notifications, whatsappConsents } from "../src/modules/reminders/schema";
import { occurrenceInWindow } from "../src/modules/reminders/time";
import { WHATSAPP_TEMPLATES, deliverableTemplateParams } from "../src/modules/reminders/templates";
import { handleWhatsappPost } from "../src/modules/reminders/webhook";
import { POST } from "../src/app/api/webhooks/whatsapp/route";

beforeEach(async () => {
  const admin = postgres(process.env.DATABASE_URL!, { max: 1 });
  await truncatePublicTables(admin);
  await admin.end();
});

afterAll(async () => {
  await closePools();
});

async function creator() {
  const auth = await registerWithPassword({
    name: "Cami Test",
    email: "cami-reminders@example.com",
    password: "password123",
    country: "AR",
    acceptTerms: true,
  });
  const base = await withUser(auth.userId, async (db) => {
    const [profile] = await db.select().from(creatorProfiles).where(eq(creatorProfiles.workspaceId, auth.workspaceId));
    const [stage] = await db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.workspaceId, auth.workspaceId))
      .orderBy(asc(pipelineStages.position));
    const [brand] = await db
      .insert(brands)
      .values({ workspaceId: auth.workspaceId, name: "Café Nube", nameNormalized: "cafe nube" })
      .returning();
    return { profile, stage, brand };
  });
  if (!base.profile || !base.stage || !base.brand) throw new Error("faltan datos de alta");
  return { ...auth, profileId: base.profile.id, stageId: base.stage.id, brandId: base.brand.id };
}

async function optIn(userId: string) {
  await withUser(userId, async (db) => {
    await db.update(users).set({ phoneE164: "+5491112345678", phoneVerifiedAt: new Date() }).where(eq(users.id, userId));
    await db.insert(whatsappConsents).values({
      userId,
      phoneE164: "+5491112345678",
      source: "web",
      consentTextVersion: WHATSAPP_CONSENT_VERSION,
    });
  });
}

describe("recordatorios", () => {
  it("arma la ventana de un recordatorio y los parámetros de la plantilla", () => {
    const anchor = new Date("2026-06-15T13:00:00Z");
    expect(occurrenceInWindow(anchor, 0, anchor)?.toISOString()).toBe(anchor.toISOString());
    expect(occurrenceInWindow(anchor, 0, new Date("2026-06-20T13:00:00Z"))).toBeNull();
    const params = deliverableTemplateParams({
      name: "Cami",
      title: "Reel",
      brand: "Café",
      date: "15/6/2026",
      url: "https://example.com",
    });
    const template = WHATSAPP_TEMPLATES.find((item) => item.name === "recordatorio_entrega");
    expect(template).toBeDefined();
    expect(params).toHaveLength(template?.parameterCount ?? 0);
    expect(parseCommand("hoy")).toEqual({ type: "today" });
    expect(parseCommand("cobros")).toEqual({ type: "payments" });
    expect(parseCommand("pendientes")).toEqual({ type: "pending" });
  });

  it("manda WhatsApp con opt-in y email si está en horario silencioso o pasó el tope", async () => {
    const account = await creator();
    await optIn(account.userId);
    const due = new Date("2026-06-15T13:00:00Z");
    await withUser(account.userId, async (db) => {
      const [deal] = await db
        .insert(deals)
        .values({
          workspaceId: account.workspaceId,
          creatorProfileId: account.profileId,
          brandId: account.brandId,
          stageId: account.stageId,
          title: "Reel serum",
          amountMinor: 45000000n,
          currency: "ARS",
        })
        .returning();
      await db.insert(deliverables).values({
        dealId: deal!.id,
        workspaceId: account.workspaceId,
        platform: "instagram",
        format: "reel",
        publishDueAt: due,
      });
    });

    const first = await dispatchReminders(due);
    expect(first.sent).toBeGreaterThan(0);
    const rows = await withUser(account.userId, async (db) => db.select().from(notifications));
    expect(rows.map((row) => row.channel).sort()).toEqual(["in_app", "whatsapp"]);
    expect(rows.find((row) => row.channel === "whatsapp")?.template).toBe("recordatorio_entrega");

    await dispatchReminders(due);
    const again = await withUser(account.userId, async (db) => db.select().from(notifications));
    expect(again).toHaveLength(rows.length);

    const quiet = new Date("2026-06-16T01:00:00Z");
    await withUser(account.userId, async (db) => {
      await db.update(deliverables).set({ publishDueAt: quiet });
    });
    await dispatchReminders(quiet);
    const quietRows = await withUser(account.userId, async (db) => db.select().from(notifications));
    expect(quietRows.some((row) => row.channel === "email" && row.status === "sent")).toBe(true);
    expect(getLastEmail()?.subject).toBe("Entrega por vencer");

    const cappedAt = new Date("2026-06-17T13:00:00Z");
    await withUser(account.userId, async (db) => {
      await db.update(deliverables).set({ publishDueAt: cappedAt });
      await db.insert(notifications).values(
        [1, 2, 3].map((index) => ({
          workspaceId: account.workspaceId,
          userId: account.userId,
          idempotencyKey: `seed-cap-${index}`,
          channel: "whatsapp" as const,
          template: "recordatorio_entrega",
          status: "sent" as const,
          sentAt: cappedAt,
        })),
      );
    });
    await dispatchReminders(cappedAt);
    const capped = await withUser(account.userId, async (db) => db.select().from(notifications));
    const freshWhatsapp = capped.filter((row) => row.channel === "whatsapp" && row.idempotencyKey.includes("2026-06-17"));
    expect(freshWhatsapp).toHaveLength(0);
    expect(capped.some((row) => row.channel === "email" && row.idempotencyKey.includes("2026-06-17"))).toBe(true);
  });

  it("arma el resumen del lunes y el de un martes", async () => {
    const account = await creator();
    await optIn(account.userId);
    const monday = new Date("2026-06-15T12:00:00Z");
    await withUser(account.userId, async (db) => {
      const [deal] = await db
        .insert(deals)
        .values({
          workspaceId: account.workspaceId,
          creatorProfileId: account.profileId,
          brandId: account.brandId,
          stageId: account.stageId,
          title: "Semana",
        })
        .returning();
      await db.insert(deliverables).values({
        dealId: deal!.id,
        workspaceId: account.workspaceId,
        platform: "instagram",
        format: "reel",
        publishDueAt: monday,
      });
    });
    expect(await sendDigests(monday)).toBeGreaterThan(0);
    const weekly = await withUser(account.userId, async (db) => db.select().from(notifications));
    expect(weekly.some((row) => row.template === "resumen_semanal")).toBe(true);

    const tuesday = new Date("2026-06-16T12:00:00Z");
    await withUser(account.userId, async (db) => {
      await db.update(deliverables).set({ publishDueAt: tuesday });
    });
    expect(await sendDigests(tuesday)).toBeGreaterThan(0);
    const daily = await withUser(account.userId, async (db) => db.select().from(notifications));
    expect(daily.some((row) => row.template === "resumen_diario")).toBe(true);
  });
});

describe("webhook de comandos", () => {
  it("rechaza una firma inválida y ejecuta ayuda, nuevo y cobré", async () => {
    const account = await creator();
    await optIn(account.userId);
    const unsigned = await POST(new Request("http://localhost/api/webhooks/whatsapp", { method: "POST", body: "{}" }));
    expect(unsigned.status).toBe(401);

    const ayuda = JSON.stringify({
      entry: [{ changes: [{ value: { messages: [{ id: "wamid.ayuda", from: "5491112345678", type: "text", text: { body: "ayuda" } }] } }] }],
    });
    const signed = await handleWhatsappPost(ayuda, signWhatsappBody("test-whatsapp-secret", ayuda));
    expect(signed.status).toBe(200);
    if (signed.status !== 200) return;
    expect(signed.body.results[0]?.reply).toContain("hoy");
    const duplicate = await handleWhatsappPost(ayuda, signWhatsappBody("test-whatsapp-secret", ayuda));
    expect(duplicate.status === 200 && duplicate.body.results[0]?.duplicate).toBe(true);

    const nuevo = JSON.stringify({
      entry: [{ changes: [{ value: { messages: [{ id: "wamid.nuevo", from: "5491112345678", type: "text", text: { body: "nuevo Café Nube 8000 ARS" } }] } }] }],
    });
    const created = await handleWhatsappPost(nuevo, signWhatsappBody("test-whatsapp-secret", nuevo));
    expect(created.status === 200 && created.body.results[0]?.reply).toContain("Café Nube");
    const cobro = JSON.stringify({
      entry: [{ changes: [{ value: { messages: [{ id: "wamid.cobre", from: "5491112345678", type: "text", text: { body: "cobré Café Nube" } }] } }] }],
    });
    const paid = await handleWhatsappPost(cobro, signWhatsappBody("test-whatsapp-secret", cobro));
    expect(paid.status === 200 && paid.body.results[0]?.reply).toContain("cobrado");
    const expectations = await withUser(account.userId, async (db) => db.select().from(paymentExpectations));
    expect(expectations[0]?.status).toBe("paid");

    expect(await executeBotCommand(account.userId, { type: "today" })).toContain("Hoy");
  });
});

describe("cuenta", () => {
  it("verifica el teléfono, exporta y borra la cuenta", async () => {
    const account = await creator();
    const started = await startPhoneVerification(account.userId, { phone: "+54 9 11 5555-0000", acceptConsent: true, country: "AR" });
    expect(started.devCode).toMatch(/^\d{6}$/);
    const confirmed = await confirmPhoneVerification(account.userId, started.devCode ?? "");
    expect(confirmed.phoneE164.startsWith("+54")).toBe(true);
    const consent = await withUser(account.userId, async (db) => db.select().from(whatsappConsents));
    expect(consent.some((row) => row.revokedAt === null)).toBe(true);

    await withUser(account.userId, async (db) => {
      const [deal] = await db
        .insert(deals)
        .values({
          workspaceId: account.workspaceId,
          creatorProfileId: account.profileId,
          brandId: account.brandId,
          stageId: account.stageId,
          title: "Canje",
        })
        .returning();
      await db.insert(paymentExpectations).values({
        dealId: deal!.id,
        workspaceId: account.workspaceId,
        amountMinor: 800000n,
        currency: "ARS",
        dueDate: "2026-06-01",
      });
      await db.insert(socialAccounts).values({
        creatorProfileId: account.profileId,
        platform: "instagram",
        handle: "cami",
        accessTokenEnc: "secreto-de-red",
      });
    });

    const exported = await exportAccount(account.userId);
    const serialized = JSON.stringify(exported, (_key, value) => (typeof value === "bigint" ? value.toString() : value));
    expect(serialized).toContain("cami-reminders@example.com");
    expect(serialized).not.toContain("password123");
    expect(serialized).not.toContain("secreto-de-red");
    expect(exportCsv(exported)).toContain("Café Nube");

    await softDeleteAccount(account.userId, "BORRAR");
    await expect(loginWithPassword({ email: "cami-reminders@example.com", password: "password123" })).rejects.toThrow();
    await withAdmin(async (db) => {
      await db.update(users).set({ deletedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) }).where(eq(users.id, account.userId));
    });
    expect((await hardDeleteExpiredAccounts(new Date())).deleted).toBe(1);
    const left = await withAdmin(async (db) => db.select().from(users));
    expect(left).toHaveLength(0);
    const tokens = await withAdmin(async (db) => db.select().from(socialAccounts));
    expect(tokens).toHaveLength(0);
  });
});

describe("adaptador de WhatsApp", () => {
  it("llama a Graph cuando hay claves y usa mock si faltan", async () => {
    const previousMode = process.env.INTEGRATIONS_MODE;
    const previousToken = process.env.WHATSAPP_TOKEN;
    const previousPhone = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const originalFetch = global.fetch;
    const calls: { url: string; body: { type?: string; template?: { components?: { type: string }[] } } }[] = [];
    global.fetch = (async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")) });
      return new Response(JSON.stringify({ messages: [{ id: "wamid.LIVE" }] }), { status: 200 });
    }) as typeof fetch;
    try {
      process.env.INTEGRATIONS_MODE = "live";
      delete process.env.WHATSAPP_TOKEN;
      delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      const mocked = await getWhatsAppAdapter().sendTemplate({
        to: "+5491112345678",
        templateName: "recordatorio_entrega",
        language: "es",
        bodyParameters: ["Cami"],
      });
      expect(mocked.providerMessageId).toContain("mock-wa-");

      process.env.WHATSAPP_TOKEN = "token";
      process.env.WHATSAPP_PHONE_NUMBER_ID = "555";
      const live = await getWhatsAppAdapter().sendTemplate({
        to: "+5491112345678",
        templateName: "verificacion_numero",
        language: "es",
        bodyParameters: ["123456"],
        buttonParameters: ["123456"],
      });
      expect(live.providerMessageId).toBe("wamid.LIVE");
      expect(calls[0]?.url).toContain("graph.facebook.com/v21.0/555/messages");
      expect(calls[0]?.body.type).toBe("template");
      expect(calls[0]?.body.template?.components?.some((component) => component.type === "button")).toBe(true);

      const adapter = new CloudWhatsAppAdapter({ token: "token", phoneNumberId: "555", fetchImpl: global.fetch });
      await expect(adapter.sendText({ to: "+5491112345678", body: "hola" })).resolves.toEqual({ providerMessageId: "wamid.LIVE" });
    } finally {
      global.fetch = originalFetch;
      process.env.INTEGRATIONS_MODE = previousMode;
      if (previousToken === undefined) delete process.env.WHATSAPP_TOKEN;
      else process.env.WHATSAPP_TOKEN = previousToken;
      if (previousPhone === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      else process.env.WHATSAPP_PHONE_NUMBER_ID = previousPhone;
    }
  });
});
