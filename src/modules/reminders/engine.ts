import { and, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { getJobsDb } from "../../db/client";
import { resolveLocale } from "../../i18n/load";
import type { Db } from "../../db/types";
import { formatCalendarDate, zonedDateISO } from "../../lib/dates";
import { getEnv } from "../../lib/env.server";
import { formatMoney } from "../../lib/money";
import { getEmailAdapter, getWhatsAppAdapter } from "../../integrations";
import { deliverableAnchor, inLocalWindow, isOpenDeliverable, isOverduePayment } from "../crm/agenda";
import { persistOverdue } from "../crm/service";
import { brands, deals, deliverables, paymentExpectations } from "../crm/schema";
import { memberships, users } from "../identity/schema";
import { escapeHtml, formatCopy } from "./copy";
import { canSendWhatsApp, zonedHour } from "./policy";
import { notifications, reminderMutes, reminderRules, whatsappConsents, whatsappMessages } from "./schema";
import {
  deliverableTemplateParams,
  digestTemplateParams,
  paymentDueTemplateParams,
  paymentOverdueTemplateParams,
  WHATSAPP_TEMPLATE_LANGUAGE,
} from "./templates";
import { addDaysISO, localDayBounds, occurrenceInWindow, reminderKey, slotFor, WHATSAPP_RETENTION_MS, weekdayInZone, zonedDateTimeToUtc } from "./time";

type Recipient = {
  userId: string;
  workspaceId: string;
  role: "owner" | "manager" | "viewer";
  email: string;
  name: string | null;
  locale: string;
  timezone: string;
  emailReminders: boolean;
};

type PlannedNotice = {
  workspaceId: string;
  userId: string;
  channel: "whatsapp" | "email" | "in_app";
  idempotencyKey: string;
  template: string;
  scheduledFor: Date;
  payload: Record<string, unknown>;
};

const OPEN_DELIVERABLE = ["pending", "in_review", "approved"] as const;

function appUrl(path: string): string {
  return `${getEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}${path}`;
}

function firstName(name: string | null, email: string): string {
  const trimmed = name?.trim();
  if (!trimmed) return email.split("@")[0] || "hola";
  return trimmed.split(/\s+/)[0] || trimmed;
}

async function claim(db: Db, notice: PlannedNotice): Promise<boolean> {
  const inserted = await db
    .insert(notifications)
    .values({
      workspaceId: notice.workspaceId,
      userId: notice.userId,
      idempotencyKey: notice.idempotencyKey,
      channel: notice.channel,
      template: notice.template,
      payload: notice.payload,
      scheduledFor: notice.scheduledFor,
      status: "pending",
    })
    .onConflictDoNothing({ target: notifications.idempotencyKey })
    .returning({ id: notifications.id });
  return inserted.length > 0;
}

export async function markPaymentsOverdue(now = new Date()): Promise<number> {
  const db = getJobsDb();
  const owners = await db
    .select({ workspaceId: memberships.workspaceId, timezone: users.timezone })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.role, "owner"), isNull(memberships.deletedAt), isNull(users.deletedAt)));
  const timezones = new Map<string, string>();
  for (const owner of owners) {
    if (!timezones.has(owner.workspaceId)) timezones.set(owner.workspaceId, owner.timezone);
  }
  let updated = 0;
  for (const [workspaceId, timezone] of timezones) {
    updated += await persistOverdue(db, workspaceId, zonedDateISO(now, timezone));
  }
  return updated;
}

export async function planReminders(now = new Date(), workspaceId?: string): Promise<number> {
  const db = getJobsDb();
  const rules = await db
    .select()
    .from(reminderRules)
    .where(
      and(
        eq(reminderRules.enabled, true),
        isNull(reminderRules.deletedAt),
        workspaceId ? eq(reminderRules.workspaceId, workspaceId) : undefined,
      ),
    );
  if (rules.length === 0) return 0;
  const workspaceIds = [...new Set(rules.map((rule) => rule.workspaceId))];
  const members = await db
    .select({
      userId: users.id,
      workspaceId: memberships.workspaceId,
      role: memberships.role,
      email: users.email,
      name: users.name,
      locale: users.locale,
      timezone: users.timezone,
      emailReminders: users.emailReminders,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(
      and(
        inArray(memberships.workspaceId, workspaceIds),
        inArray(memberships.role, ["owner", "manager"]),
        isNull(memberships.deletedAt),
        isNull(users.deletedAt),
      ),
    );
  const recipientsByWorkspace = new Map<string, Recipient[]>();
  for (const member of members) {
    const list = recipientsByWorkspace.get(member.workspaceId) ?? [];
    list.push({ ...member, locale: resolveLocale(member.locale) });
    recipientsByWorkspace.set(member.workspaceId, list);
  }
  const userIds = [...new Set(members.map((member) => member.userId))];
  const consents = userIds.length
    ? await db
        .select({ userId: whatsappConsents.userId, phoneE164: whatsappConsents.phoneE164 })
        .from(whatsappConsents)
        .where(and(inArray(whatsappConsents.userId, userIds), isNull(whatsappConsents.revokedAt), isNull(whatsappConsents.deletedAt)))
    : [];
  const consentByUser = new Map(consents.map((consent) => [consent.userId, consent.phoneE164]));
  const mutes = await db
    .select({ userId: reminderMutes.userId, dealId: reminderMutes.dealId })
    .from(reminderMutes)
    .where(and(inArray(reminderMutes.workspaceId, workspaceIds), isNull(reminderMutes.deletedAt)));
  const muted = new Set(mutes.map((mute) => `${mute.userId}:${mute.dealId}`));
  const sentRows = userIds.length
    ? await db
        .select({ userId: notifications.userId, sentAt: notifications.sentAt })
        .from(notifications)
        .where(
          and(
            inArray(notifications.userId, userIds),
            eq(notifications.channel, "whatsapp"),
            eq(notifications.status, "sent"),
            gte(notifications.sentAt, new Date(now.getTime() - 36 * 60 * 60 * 1000)),
          ),
        )
    : [];
  const timezones = new Map(members.map((member) => [member.userId, member.timezone]));
  const sentToday = new Map<string, number>();
  for (const row of sentRows) {
    if (!row.sentAt) continue;
    const timezone = timezones.get(row.userId) ?? "UTC";
    if (row.sentAt < localDayBounds(now, timezone).start) continue;
    sentToday.set(row.userId, (sentToday.get(row.userId) ?? 0) + 1);
  }
  const existingKeyRows = userIds.length
    ? await db.select({ key: notifications.idempotencyKey }).from(notifications).where(inArray(notifications.userId, userIds))
    : [];
  const existingKeys = new Set(existingKeyRows.map((row) => row.key));

  const [deliveryRows, paymentRows] = await Promise.all([
    db
      .select({
        id: deliverables.id,
        dealId: deliverables.dealId,
        workspaceId: deliverables.workspaceId,
        status: deliverables.status,
        publishDueAt: deliverables.publishDueAt,
        approvalDueAt: deliverables.approvalDueAt,
        draftDueAt: deliverables.draftDueAt,
        dealTitle: deals.title,
        brandName: brands.name,
      })
      .from(deliverables)
      .innerJoin(deals, eq(deals.id, deliverables.dealId))
      .innerJoin(brands, eq(brands.id, deals.brandId))
      .where(
        and(
          inArray(deliverables.workspaceId, workspaceIds),
          inArray(deliverables.status, [...OPEN_DELIVERABLE]),
          isNull(deliverables.deletedAt),
          isNull(deals.deletedAt),
        ),
      ),
    db
      .select({
        id: paymentExpectations.id,
        dealId: paymentExpectations.dealId,
        workspaceId: paymentExpectations.workspaceId,
        amountMinor: paymentExpectations.amountMinor,
        currency: paymentExpectations.currency,
        dueDate: paymentExpectations.dueDate,
        status: paymentExpectations.status,
        brandName: brands.name,
      })
      .from(paymentExpectations)
      .innerJoin(deals, eq(deals.id, paymentExpectations.dealId))
      .innerJoin(brands, eq(brands.id, deals.brandId))
      .where(
        and(
          inArray(paymentExpectations.workspaceId, workspaceIds),
          inArray(paymentExpectations.status, ["pending", "overdue", "partial"]),
          isNull(paymentExpectations.deletedAt),
          isNull(deals.deletedAt),
        ),
      ),
  ]);

  const notices: PlannedNotice[] = [];
  for (const rule of rules) {
    const recipients = recipientsByWorkspace.get(rule.workspaceId) ?? [];
    if (rule.entity === "deliverable") {
      for (const row of deliveryRows) {
        if (row.workspaceId !== rule.workspaceId) continue;
        const anchor = deliverableAnchor(row);
        if (!anchor) continue;
        const occurrence = occurrenceInWindow(anchor, rule.offsetMinutes, now);
        if (!occurrence) continue;
        for (const recipient of recipients) {
          if (muted.has(`${recipient.userId}:${row.dealId}`)) continue;
          const date = formatCalendarDate(zonedDateISO(anchor, recipient.timezone), recipient.locale);
          const params = deliverableTemplateParams({
            name: firstName(recipient.name, recipient.email),
            title: row.dealTitle,
            brand: row.brandName,
            date,
            url: appUrl("/entregables"),
          });
          notices.push(
            ...noticesFor({
              recipient,
              entity: "deliverable",
              entityId: row.id,
              slot: slotFor("deliverable", rule.offsetMinutes),
              occurrence,
              templateName: "recordatorio_entrega",
              title: formatCopy(recipient.locale, "notify.deliverableTitle"),
              body: formatCopy(recipient.locale, "notify.deliverableBody", { brand: row.brandName, title: row.dealTitle, date }),
              url: appUrl("/entregables"),
              bodyParameters: params,
              consent: consentByUser.has(recipient.userId),
              sentToday,
              existingKeys,
              now,
            }),
          );
        }
      }
    } else {
      for (const row of paymentRows) {
        if (row.workspaceId !== rule.workspaceId) continue;
        for (const recipient of recipients) {
          if (muted.has(`${recipient.userId}:${row.dealId}`)) continue;
          const anchor = zonedDateTimeToUtc(row.dueDate, 9, 0, recipient.timezone);
          const occurrence = occurrenceInWindow(anchor, rule.offsetMinutes, now);
          if (!occurrence) continue;
          const amount = formatMoney(row.amountMinor, row.currency, recipient.locale);
          const date = formatCalendarDate(row.dueDate, recipient.locale);
          const overdue = rule.offsetMinutes > 0;
          const templateName = overdue ? "cobro_vencido" : "cobro_por_vencer";
          const bodyParameters = overdue
            ? paymentOverdueTemplateParams({
                name: firstName(recipient.name, recipient.email),
                brand: row.brandName,
                amount,
                date,
                url: appUrl("/cobros"),
              })
            : paymentDueTemplateParams({
                name: firstName(recipient.name, recipient.email),
                brand: row.brandName,
                amount,
                url: appUrl("/cobros"),
              });
          notices.push(
            ...noticesFor({
              recipient,
              entity: "payment",
              entityId: row.id,
              slot: slotFor("payment", rule.offsetMinutes),
              occurrence,
              templateName,
              title: formatCopy(recipient.locale, overdue ? "notify.paymentOverdueTitle" : "notify.paymentDueTitle"),
              body: formatCopy(recipient.locale, overdue ? "notify.paymentOverdueBody" : "notify.paymentDueBody", {
                brand: row.brandName,
                amount,
                date,
              }),
              url: appUrl("/cobros"),
              bodyParameters,
              consent: consentByUser.has(recipient.userId),
              sentToday,
              existingKeys,
              now,
            }),
          );
        }
      }
    }
  }

  let created = 0;
  for (const notice of notices) {
    if (await claim(db, notice)) created += 1;
  }
  return created;
}

function noticesFor(input: {
  recipient: Recipient;
  entity: "deliverable" | "payment";
  entityId: string;
  slot: string;
  occurrence: Date;
  templateName: string;
  title: string;
  body: string;
  url: string;
  bodyParameters: string[];
  consent: boolean;
  sentToday: Map<string, number>;
  existingKeys: Set<string>;
  now: Date;
}): PlannedNotice[] {
  const payload = {
    title: input.title,
    body: input.body,
    url: input.url,
    templateName: input.templateName,
    bodyParameters: input.bodyParameters,
  };
  const base = {
    workspaceId: input.recipient.workspaceId,
    userId: input.recipient.userId,
    scheduledFor: input.occurrence,
    payload,
  };
  const whatsappKey = reminderKey({
    entity: input.entity,
    entityId: input.entityId,
    slot: input.slot,
    occurrence: input.occurrence,
    channel: "whatsapp",
    userId: input.recipient.userId,
  });
  const external = externalChannel(input.recipient, input.consent, input.sentToday, input.now, whatsappKey, input.existingKeys);
  const rows: PlannedNotice[] = [
    {
      ...base,
      channel: "in_app",
      template: input.templateName,
      idempotencyKey: reminderKey({
        entity: input.entity,
        entityId: input.entityId,
        slot: input.slot,
        occurrence: input.occurrence,
        channel: "in_app",
        userId: input.recipient.userId,
      }),
    },
  ];
  if (external) {
    rows.push({
      ...base,
      channel: external,
      template: input.templateName,
      idempotencyKey: reminderKey({
        entity: input.entity,
        entityId: input.entityId,
        slot: input.slot,
        occurrence: input.occurrence,
        channel: external,
        userId: input.recipient.userId,
      }),
    });
  }
  return rows;
}

function externalChannel(
  recipient: Recipient,
  consent: boolean,
  sentToday: Map<string, number>,
  now: Date,
  whatsappKey?: string,
  existingKeys?: Set<string>,
): "whatsapp" | "email" | null {
  const sent = sentToday.get(recipient.userId) ?? 0;
  if (consent && canSendWhatsApp({ now, timeZone: recipient.timezone, sentToday: sent }).ok) {
    if (!whatsappKey || !existingKeys?.has(whatsappKey)) sentToday.set(recipient.userId, sent + 1);
    return "whatsapp";
  }
  if (recipient.emailReminders) return "email";
  return null;
}

function swapChannel(key: string, from: string, to: string): string {
  if (key.endsWith(`:${from}`)) return `${key.slice(0, -from.length)}${to}`;
  return key.replace(`:${from}:`, `:${to}:`);
}

type StoredPayload = {
  title: string;
  body: string;
  url: string;
  templateName: string;
  bodyParameters: string[];
  buttonParameters?: string[];
};

function readPayload(value: unknown): StoredPayload | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.title !== "string" || typeof record.body !== "string") return null;
  return {
    title: record.title,
    body: record.body,
    url: typeof record.url === "string" ? record.url : "",
    templateName: typeof record.templateName === "string" ? record.templateName : "",
    bodyParameters: Array.isArray(record.bodyParameters) ? record.bodyParameters.map(String) : [],
    buttonParameters: Array.isArray(record.buttonParameters) ? record.buttonParameters.map(String) : undefined,
  };
}

export async function sendPendingNotifications(now = new Date()): Promise<{ sent: number; failed: number; deferred: number }> {
  const db = getJobsDb();
  const pending = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.status, "pending"),
        isNull(notifications.deletedAt),
        or(isNull(notifications.scheduledFor), lte(notifications.scheduledFor, now)),
      ),
    )
    .limit(400);
  if (pending.length === 0) return { sent: 0, failed: 0, deferred: 0 };
  const userIds = [...new Set(pending.map((row) => row.userId))];
  const people = await db.select().from(users).where(inArray(users.id, userIds));
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const consents = await db
    .select()
    .from(whatsappConsents)
    .where(and(inArray(whatsappConsents.userId, userIds), isNull(whatsappConsents.revokedAt), isNull(whatsappConsents.deletedAt)));
  const consentByUser = new Map(consents.map((consent) => [consent.userId, consent]));
  const recent = await db
    .select({ userId: notifications.userId, sentAt: notifications.sentAt })
    .from(notifications)
    .where(
      and(
        inArray(notifications.userId, userIds),
        eq(notifications.channel, "whatsapp"),
        eq(notifications.status, "sent"),
        gte(notifications.sentAt, new Date(now.getTime() - 36 * 60 * 60 * 1000)),
      ),
    );
  const sentToday = new Map<string, number>();
  for (const row of recent) {
    if (!row.sentAt) continue;
    const timezone = peopleById.get(row.userId)?.timezone ?? "UTC";
    if (row.sentAt < localDayBounds(now, timezone).start) continue;
    sentToday.set(row.userId, (sentToday.get(row.userId) ?? 0) + 1);
  }

  let sent = 0;
  let failed = 0;
  let deferred = 0;
  for (const row of pending) {
    const person = peopleById.get(row.userId);
    if (!person || person.deletedAt) {
      await db.update(notifications).set({ status: "cancelled", error: "usuario dado de baja" }).where(eq(notifications.id, row.id));
      continue;
    }
    if (row.channel === "in_app") {
      await db.update(notifications).set({ status: "sent", sentAt: now }).where(eq(notifications.id, row.id));
      sent += 1;
      continue;
    }
    const payload = readPayload(row.payload);
    if (!payload) {
      await db.update(notifications).set({ status: "failed", error: "payload inválido" }).where(eq(notifications.id, row.id));
      failed += 1;
      continue;
    }
    try {
      if (row.channel === "whatsapp") {
        const consent = consentByUser.get(row.userId);
        const allowance = canSendWhatsApp({
          now,
          timeZone: person.timezone,
          sentToday: sentToday.get(row.userId) ?? 0,
        });
        if (!consent || !allowance.ok) {
          if (allowance.reason === "quiet_hours") {
            deferred += 1;
            continue;
          }
          await db.update(notifications).set({ status: "cancelled", error: allowance.reason ?? "sin consentimiento" }).where(eq(notifications.id, row.id));
          if (person.emailReminders) {
            const emailKey = swapChannel(row.idempotencyKey, "whatsapp", "email");
            await claim(db, {
              workspaceId: row.workspaceId,
              userId: row.userId,
              channel: "email",
              idempotencyKey: emailKey,
              template: row.template,
              scheduledFor: now,
              payload: row.payload as Record<string, unknown>,
            });
          }
          continue;
        }
        const result = await getWhatsAppAdapter().sendTemplate({
          to: consent.phoneE164,
          templateName: payload.templateName,
          language: WHATSAPP_TEMPLATE_LANGUAGE,
          bodyParameters: payload.bodyParameters,
          buttonParameters: payload.buttonParameters,
        });
        await db
          .update(notifications)
          .set({ status: "sent", sentAt: now, providerMessageId: result.providerMessageId, error: null })
          .where(eq(notifications.id, row.id));
        await db.insert(whatsappMessages).values({
          userId: row.userId,
          direction: "out",
          waMessageId: result.providerMessageId,
          type: "template",
          templateName: payload.templateName,
          category: payload.templateName === "verificacion_numero" ? "authentication" : "utility",
          body: payload.body.slice(0, 500),
          billable: true,
          status: "accepted",
        });
        sentToday.set(row.userId, (sentToday.get(row.userId) ?? 0) + 1);
        sent += 1;
        continue;
      }
      const footer = formatCopy(person.locale, "notify.emailFooter");
      const result = await getEmailAdapter().send({
        to: person.email,
        subject: payload.title,
        text: `${payload.body}\n\n${payload.url}\n\n${footer}`,
        html: `<p>${escapeHtml(payload.body)}</p><p><a href="${escapeHtml(payload.url)}">${escapeHtml(payload.url)}</a></p><p>${escapeHtml(footer)}</p>`,
      });
      await db
        .update(notifications)
        .set({ status: "sent", sentAt: now, providerMessageId: result.id, error: null })
        .where(eq(notifications.id, row.id));
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "error de envío";
      await db.update(notifications).set({ status: "failed", error: message.slice(0, 500) }).where(eq(notifications.id, row.id));
      failed += 1;
    }
  }
  return { sent, failed, deferred };
}

export async function dispatchReminders(now = new Date(), workspaceId?: string): Promise<{
  overdue: number;
  planned: number;
  sent: number;
  failed: number;
  deferred: number;
}> {
  const overdue = await markPaymentsOverdue(now);
  const planned = await planReminders(now, workspaceId);
  const delivery = await sendPendingNotifications(now);
  return { overdue, planned, ...delivery };
}

export async function sendDigests(now = new Date()): Promise<number> {
  const db = getJobsDb();
  const members = await db
    .select({
      userId: users.id,
      workspaceId: memberships.workspaceId,
      email: users.email,
      name: users.name,
      locale: users.locale,
      timezone: users.timezone,
      emailReminders: users.emailReminders,
      dailySummary: users.dailySummary,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(inArray(memberships.role, ["owner", "manager"]), isNull(memberships.deletedAt), isNull(users.deletedAt)));
  const byUser = new Map<string, typeof members>();
  for (const member of members) {
    if (!member.dailySummary) continue;
    if (zonedHour(now, member.timezone) !== 9) continue;
    const list = byUser.get(member.userId) ?? [];
    list.push({ ...member, locale: resolveLocale(member.locale) });
    byUser.set(member.userId, list);
  }
  if (byUser.size === 0) return 0;
  const workspaceIds = [...new Set([...byUser.values()].flat().map((member) => member.workspaceId))];
  const [deliveryRows, paymentRows, consents, sentRows] = await Promise.all([
    db
      .select({
        workspaceId: deliverables.workspaceId,
        status: deliverables.status,
        publishDueAt: deliverables.publishDueAt,
        approvalDueAt: deliverables.approvalDueAt,
        draftDueAt: deliverables.draftDueAt,
      })
      .from(deliverables)
      .innerJoin(deals, eq(deals.id, deliverables.dealId))
      .where(and(inArray(deliverables.workspaceId, workspaceIds), isNull(deliverables.deletedAt), isNull(deals.deletedAt))),
    db
      .select({
        workspaceId: paymentExpectations.workspaceId,
        dueDate: paymentExpectations.dueDate,
        status: paymentExpectations.status,
      })
      .from(paymentExpectations)
      .innerJoin(deals, eq(deals.id, paymentExpectations.dealId))
      .where(
        and(
          inArray(paymentExpectations.workspaceId, workspaceIds),
          isNull(paymentExpectations.deletedAt),
          isNull(deals.deletedAt),
        ),
      ),
    db
      .select({ userId: whatsappConsents.userId })
      .from(whatsappConsents)
      .where(and(inArray(whatsappConsents.userId, [...byUser.keys()]), isNull(whatsappConsents.revokedAt), isNull(whatsappConsents.deletedAt))),
    db
      .select({ userId: notifications.userId, sentAt: notifications.sentAt })
      .from(notifications)
      .where(
        and(
          inArray(notifications.userId, [...byUser.keys()]),
          eq(notifications.channel, "whatsapp"),
          eq(notifications.status, "sent"),
          gte(notifications.sentAt, new Date(now.getTime() - 36 * 60 * 60 * 1000)),
        ),
      ),
  ]);
  const consentIds = new Set(consents.map((consent) => consent.userId));
  const sentToday = new Map<string, number>();
  for (const row of sentRows) {
    if (!row.sentAt) continue;
    const timezone = byUser.get(row.userId)?.[0]?.timezone ?? "UTC";
    if (row.sentAt < localDayBounds(now, timezone).start) continue;
    sentToday.set(row.userId, (sentToday.get(row.userId) ?? 0) + 1);
  }

  let created = 0;
  for (const [userId, workspaces] of byUser) {
    const person = workspaces[0];
    if (!person) continue;
    const today = zonedDateISO(now, person.timezone);
    const weekEnd = addDaysISO(today, 6);
    const weekly = weekdayInZone(now, person.timezone) === 1;
    const workspaceSet = new Set(workspaces.map((workspace) => workspace.workspaceId));
    let deliverableCount = 0;
    let overdueCount = 0;
    for (const row of deliveryRows) {
      if (!workspaceSet.has(row.workspaceId)) continue;
      if (!isOpenDeliverable(row.status)) continue;
      const anchor = deliverableAnchor(row);
      if (!anchor) continue;
      if (weekly) {
        if (inLocalWindow(anchor, person.timezone, today, weekEnd)) deliverableCount += 1;
      } else if (inLocalWindow(anchor, person.timezone, today, today)) deliverableCount += 1;
    }
    for (const row of paymentRows) {
      if (!workspaceSet.has(row.workspaceId)) continue;
      if (isOverduePayment(row.status, row.dueDate, today)) overdueCount += 1;
    }
    if (deliverableCount === 0 && overdueCount === 0) continue;
    const kind = weekly ? "weekly" : "daily";
    const templateName = weekly ? "resumen_semanal" : "resumen_diario";
    const title = formatCopy(person.locale, weekly ? "notify.weeklyTitle" : "notify.dailyTitle");
    const body = formatCopy(person.locale, weekly ? "notify.weeklyBody" : "notify.dailyBody", {
      deliverables: deliverableCount,
      overdue: overdueCount,
    });
    const url = appUrl("/hoy");
    const bodyParameters = digestTemplateParams({
      name: firstName(person.name, person.email),
      deliverables: deliverableCount,
      overdue: overdueCount,
      url,
    });
    const occurrence = zonedDateTimeToUtc(today, 9, 0, person.timezone);
    const payload = { title, body, url, templateName, bodyParameters };
    const recipient: Recipient = { ...person, role: "owner" };
    const external = externalChannel(recipient, consentIds.has(userId), sentToday, now, `digest:${userId}:${today}:${kind}:whatsapp`);
    const rows: PlannedNotice[] = workspaces.map((workspace) => ({
      workspaceId: workspace.workspaceId,
      userId,
      channel: "in_app" as const,
      template: templateName,
      scheduledFor: occurrence,
      payload,
      idempotencyKey: `digest:${userId}:${today}:${kind}:in_app:${workspace.workspaceId}`,
    }));
    if (external) {
      rows.push({
        workspaceId: person.workspaceId,
        userId,
        channel: external,
        template: templateName,
        scheduledFor: occurrence,
        payload,
        idempotencyKey: `digest:${userId}:${today}:${kind}:${external}`,
      });
    }
    for (const notice of rows) {
      if (await claim(db, notice)) created += 1;
    }
  }
  if (created > 0) await sendPendingNotifications(now);
  return created;
}

export async function purgeExpiredWhatsappMessages(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - WHATSAPP_RETENTION_MS);
  const removed = await getJobsDb()
    .delete(whatsappMessages)
    .where(lte(whatsappMessages.createdAt, cutoff))
    .returning({ id: whatsappMessages.id });
  return removed.length;
}
