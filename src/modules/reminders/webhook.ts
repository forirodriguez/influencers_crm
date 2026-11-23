import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { getJobsDb } from "../../db/client";
import { getWhatsAppAdapter } from "../../integrations";
import { users } from "../identity/schema";
import { resolveLocale } from "../../i18n/load";
import { executeBotCommand } from "./bot";
import { parseCommand } from "./commands";
import { formatCopy } from "./copy";
import { whatsappConsents, whatsappMessages } from "./schema";

export type WebhookResult = {
  waMessageId: string;
  from: string;
  command: string | null;
  reply: string | null;
  duplicate: boolean;
};

function digits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function readStatuses(payload: unknown): { id: string; status: string; pricingCategory?: string }[] {
  if (!payload || typeof payload !== "object") return [];
  const entries = (payload as { entry?: unknown }).entry;
  if (!Array.isArray(entries)) return [];
  const updates: { id: string; status: string; pricingCategory?: string }[] = [];
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown }).changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const statuses = (change as { value?: { statuses?: unknown } }).value?.statuses;
      if (!Array.isArray(statuses)) continue;
      for (const status of statuses) {
        const item = status as { id?: string; status?: string; pricing?: { category?: string } };
        if (!item.id || !item.status) continue;
        updates.push({ id: item.id, status: item.status, pricingCategory: item.pricing?.category });
      }
    }
  }
  return updates;
}

async function findUser(from: string) {
  const db = getJobsDb();
  const wanted = digits(from);
  const rows = await db
    .select({
      id: users.id,
      phoneE164: users.phoneE164,
      locale: users.locale,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(and(isNull(users.deletedAt), isNotNull(users.phoneE164)));
  return rows.find((row) => digits(row.phoneE164) === wanted) ?? null;
}

export async function handleWhatsappPost(raw: string, signature: string | null): Promise<
  | { status: 401 | 400; body: { error: { code: string; message: string } } }
  | { status: 200; body: { received: number; executed: true; results: WebhookResult[] } }
> {
  const adapter = getWhatsAppAdapter();
  if (!adapter.verifySignature(raw, signature)) {
    return { status: 401, body: { error: { code: "invalid_signature", message: "Firma inválida" } } };
  }
  let payload: unknown = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    return { status: 400, body: { error: { code: "invalid_json", message: "JSON inválido" } } };
  }
  const db = getJobsDb();
  for (const update of readStatuses(payload)) {
    await db
      .update(whatsappMessages)
      .set({ status: update.status, pricingCategory: update.pricingCategory ?? null })
      .where(eq(whatsappMessages.waMessageId, update.id));
  }
  const messages = adapter.parseInbound(payload);
  const results: WebhookResult[] = [];
  for (const message of messages) {
    const [existing] = await db
      .select({ id: whatsappMessages.id })
      .from(whatsappMessages)
      .where(eq(whatsappMessages.waMessageId, message.id))
      .limit(1);
    if (existing) {
      results.push({ waMessageId: message.id, from: message.from, command: null, reply: null, duplicate: true });
      continue;
    }
    const command = message.type === "text" ? parseCommand(message.body) : { type: "unparsed" as const, text: message.body };
    const user = await findUser(message.from);
    if (!user) {
      const reply = formatCopy("es-UY", "bot.noAccount");
      await adapter.sendText({ to: message.from, body: reply });
      results.push({ waMessageId: message.id, from: message.from, command: command?.type ?? null, reply, duplicate: false });
      continue;
    }
    await db.insert(whatsappMessages).values({
      userId: user.id,
      direction: "in",
      waMessageId: message.id,
      type: message.type,
      category: "service",
      body: message.body.slice(0, 500),
      billable: false,
      status: "received",
    });
    const [consent] = await db
      .select({ id: whatsappConsents.id })
      .from(whatsappConsents)
      .where(and(eq(whatsappConsents.userId, user.id), isNull(whatsappConsents.revokedAt), isNull(whatsappConsents.deletedAt)))
      .limit(1);
    let reply: string;
    if (!consent && command?.type !== "unsubscribe") {
      reply = formatCopy(resolveLocale(user.locale), "bot.noConsent");
    } else if (!command) {
      reply = formatCopy(resolveLocale(user.locale), "bot.unparsed");
    } else {
      reply = await executeBotCommand(user.id, command);
    }
    const outbound = await adapter.sendText({ to: message.from, body: reply });
    await db.insert(whatsappMessages).values({
      userId: user.id,
      direction: "out",
      waMessageId: outbound.providerMessageId,
      type: "text",
      category: "service",
      body: reply.slice(0, 500),
      billable: false,
      status: "accepted",
    });
    results.push({ waMessageId: message.id, from: message.from, command: command?.type ?? null, reply, duplicate: false });
  }
  return { status: 200, body: { received: messages.length, executed: true, results } };
}
