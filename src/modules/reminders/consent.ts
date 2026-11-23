import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { withUser } from "../../db/client";
import type { Db } from "../../db/types";
import { WHATSAPP_CONSENT_VERSION } from "../../lib/constants";
import { getEnv } from "../../lib/env.server";
import { ApiError } from "../../lib/errors";
import { toE164 } from "../../lib/phone";
import { rateLimit } from "../../lib/rate-limit";
import { getWhatsAppAdapter } from "../../integrations";
import { users } from "../identity/schema";
import { phoneVerifications, whatsappConsents, whatsappMessages } from "./schema";
import { WHATSAPP_TEMPLATE_LANGUAGE, sanitizeTemplateParam } from "./templates";

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function hashesMatch(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function exposeDevCode(): boolean {
  const env = getEnv();
  return env.AUTH_DEV_EXPOSE_LINKS === "true" || env.INTEGRATIONS_MODE !== "live";
}

export async function revokeConsent(db: Db, userId: string): Promise<void> {
  await db
    .update(whatsappConsents)
    .set({ revokedAt: new Date() })
    .where(and(eq(whatsappConsents.userId, userId), isNull(whatsappConsents.revokedAt), isNull(whatsappConsents.deletedAt)));
}

export async function startPhoneVerification(userId: string, input: { phone: string; acceptConsent: boolean; country?: string }): Promise<{ devCode?: string }> {
  if (input.acceptConsent !== true) {
    throw new ApiError("consent_required", "Tenés que aceptar recibir recordatorios por WhatsApp", 400);
  }
  if (!rateLimit(`wa-verify:${userId}`, 5, 15 * 60 * 1000)) {
    throw new ApiError("rate_limited", "Demasiados códigos. Esperá un rato", 429);
  }
  const country = input.country === "AR" || input.country === "MX" || input.country === "CO" || input.country === "UY" ? input.country : undefined;
  const phone = toE164(input.phone, country);
  if (!phone) throw new ApiError("invalid_phone", "El número tiene que estar en formato internacional", 400);
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await withUser(userId, async (db) => {
    await db.insert(phoneVerifications).values({ userId, phoneE164: phone, codeHash: hashCode(code), expiresAt });
  });
  const result = await getWhatsAppAdapter().sendTemplate({
    to: phone,
    templateName: "verificacion_numero",
    language: WHATSAPP_TEMPLATE_LANGUAGE,
    bodyParameters: [sanitizeTemplateParam(code)],
    buttonParameters: [sanitizeTemplateParam(code)],
  });
  await withUser(userId, async (db) => {
    await db.insert(whatsappMessages).values({
      userId,
      direction: "out",
      waMessageId: result.providerMessageId,
      type: "template",
      templateName: "verificacion_numero",
      category: "authentication",
      body: "código de verificación",
      billable: true,
      status: "accepted",
    });
  });
  return exposeDevCode() ? { devCode: code } : {};
}

export async function confirmPhoneVerification(userId: string, code: string): Promise<{ phoneE164: string }> {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) throw new ApiError("invalid_code", "El código tiene 6 dígitos", 400);
  return withUser(userId, async (db) => {
    const [row] = await db
      .select()
      .from(phoneVerifications)
      .where(eq(phoneVerifications.userId, userId))
      .orderBy(desc(phoneVerifications.createdAt))
      .limit(1);
    if (!row || row.consumedAt || row.expiresAt.getTime() < Date.now() || !hashesMatch(row.codeHash, hashCode(normalized))) {
      throw new ApiError("invalid_code", "El código venció o no coincide", 400);
    }
    await db.update(phoneVerifications).set({ consumedAt: new Date() }).where(eq(phoneVerifications.id, row.id));
    await db.update(users).set({ phoneE164: row.phoneE164, phoneVerifiedAt: new Date() }).where(eq(users.id, userId));
    await revokeConsent(db, userId);
    await db.insert(whatsappConsents).values({
      userId,
      phoneE164: row.phoneE164,
      source: "web",
      consentTextVersion: WHATSAPP_CONSENT_VERSION,
    });
    return { phoneE164: row.phoneE164 };
  });
}

export async function revokeWhatsappConsent(userId: string): Promise<void> {
  await withUser(userId, async (db) => {
    await revokeConsent(db, userId);
  });
}
