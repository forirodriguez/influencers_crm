import { and, eq, isNull } from "drizzle-orm";
import { withUser, getJobsDb } from "../../db/client";
import { resolveLocale } from "../../i18n/load";
import { addDaysISO, zonedDateISO } from "../../lib/dates";
import { getEnv } from "../../lib/env.server";
import { ApiError } from "../../lib/errors";
import { formatMoney } from "../../lib/money";
import { normalizeName } from "../../lib/names";
import { deliverableAnchor, inLocalWindow, isOpenDeliverable, isOpenPayment } from "../crm/agenda";
import { listDeliverables, listPaymentExpectations, listProfiles } from "../crm/queries";
import { activities } from "../crm/schema";
import { createDeal as createCrmDeal, recordReceipt } from "../crm/service";
import { displayPaymentStatus, outstandingMinor } from "../crm/status";
import { memberships, users, workspaces } from "../identity/schema";
import type { BotCommand } from "./commands";
import { revokeConsent } from "./consent";
import { formatCopy } from "./copy";

type WorkspaceLink = {
  workspaceId: string;
  role: "owner" | "manager" | "viewer";
  type: "personal" | "agency";
  currency: string;
};

function appUrl(path: string): string {
  return `${getEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}${path}`;
}

function clip(lines: string[], locale: string): string {
  const visible = lines.slice(0, 5);
  const extra = lines.length - visible.length;
  const body = visible.join("\n");
  return extra > 0 ? `${body}\n${formatCopy(locale, "bot.more", { count: extra })}` : body;
}

function minorToInput(amountMinor: bigint): string {
  const absolute = amountMinor < 0n ? -amountMinor : amountMinor;
  const whole = absolute / 100n;
  const cents = absolute % 100n;
  const text = cents === 0n ? whole.toString() : `${whole}.${cents.toString().padStart(2, "0")}`;
  return amountMinor < 0n ? `-${text}` : text;
}

async function linksFor(userId: string): Promise<{ locale: string; timezone: string; name: string | null; links: WorkspaceLink[] }> {
  return withUser(userId, async (db) => {
    const [user] = await db.select().from(users).where(and(eq(users.id, userId), isNull(users.deletedAt))).limit(1);
    if (!user) throw new Error("usuario inexistente");
    const rows = await db
      .select({
        workspaceId: memberships.workspaceId,
        role: memberships.role,
        type: workspaces.type,
        currency: workspaces.defaultCurrency,
      })
      .from(memberships)
      .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
      .where(and(eq(memberships.userId, userId), isNull(memberships.deletedAt), isNull(workspaces.deletedAt)));
    return { locale: resolveLocale(user.locale), timezone: user.timezone, name: user.name, links: rows };
  });
}

function writable(links: WorkspaceLink[]): WorkspaceLink[] {
  return links.filter((link) => link.role === "owner" || link.role === "manager");
}

function homeWorkspace(links: WorkspaceLink[]): WorkspaceLink | null {
  return links.find((link) => link.type === "personal" && link.role === "owner") ?? writable(links)[0] ?? null;
}

async function deliverableLines(userId: string, workspaceIds: string[], locale: string, timezone: string, filter: "today" | "week" | "open", now: Date) {
  if (workspaceIds.length === 0) return [];
  const today = zonedDateISO(now, timezone);
  const weekEnd = addDaysISO(today, 6);
  const lines: string[] = [];
  await withUser(userId, async (db) => {
    for (const workspaceId of workspaceIds) {
      const rows = await listDeliverables(db, workspaceId);
      for (const row of rows) {
        if (!isOpenDeliverable(row.status)) continue;
        const anchor = deliverableAnchor(row);
        const local = anchor ? zonedDateISO(anchor, timezone) : "";
        if (filter === "today" && local !== today) continue;
        if (filter === "week" && (!anchor || !inLocalWindow(anchor, timezone, today, weekEnd))) continue;
        lines.push(formatCopy(locale, "bot.lineDeliverable", { brand: row.brandName, title: row.dealTitle, date: local || "sin fecha" }));
      }
    }
  });
  return lines;
}

async function paymentLines(userId: string, workspaceIds: string[], locale: string, timezone: string, now: Date) {
  if (workspaceIds.length === 0) return [];
  const today = zonedDateISO(now, timezone);
  const lines: string[] = [];
  await withUser(userId, async (db) => {
    for (const workspaceId of workspaceIds) {
      const rows = await listPaymentExpectations(db, workspaceId);
      for (const row of rows) {
        if (!isOpenPayment(row.status, row.dueDate, today)) continue;
        const shown = displayPaymentStatus(row.status, row.dueDate, today);
        const outstanding = outstandingMinor(row.amountMinor, row.receivedMinor);
        lines.push(
          formatCopy(locale, "bot.linePayment", {
            brand: row.brandName,
            amount: formatMoney(outstanding > 0n ? outstanding : row.amountMinor, row.currency, locale),
            status: formatCopy(locale, `labels.${shown}`),
            date: row.dueDate,
          }),
        );
      }
    }
  });
  return lines;
}

async function createDeal(userId: string, command: Extract<BotCommand, { type: "new_deal" }>): Promise<string> {
  const context = await linksFor(userId);
  const workspace = homeWorkspace(context.links);
  if (!workspace) return formatCopy(context.locale, "bot.needProfile");
  try {
    const created = await withUser(userId, async (db) => {
      const profiles = await listProfiles(db, workspace.workspaceId);
      const chosen = profiles.find((item) => item.userId === userId) ?? profiles[0];
      if (!chosen) throw new ApiError("profile_required", "falta el perfil", 400);
      const deal = await createCrmDeal(db, { userId, workspaceId: workspace.workspaceId }, {
        title: `Acuerdo con ${command.brand}`.slice(0, 160),
        brandName: command.brand,
        creatorProfileId: chosen.id,
        compensationType: "paid",
        amount: minorToInput(command.amountMinor),
        currency: command.currency,
        source: "whatsapp",
        notes: "Creado por el comando nuevo de WhatsApp.",
      });
      await db.insert(activities).values({
        workspaceId: workspace.workspaceId,
        dealId: deal.id,
        actorUserId: userId,
        type: "whatsapp_inbound",
        payload: { command: "nuevo", brand: command.brand },
      });
      return deal;
    });
    return formatCopy(context.locale, "bot.created", {
      brand: command.brand,
      amount: formatMoney(command.amountMinor, command.currency, context.locale),
      url: appUrl(`/acuerdos/${created.id}`),
    });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 400 || error.status === 404)) {
      return formatCopy(context.locale, "bot.needProfile");
    }
    throw error;
  }
}

async function markPaid(userId: string, brandName: string, now: Date): Promise<string> {
  const context = await linksFor(userId);
  const places = writable(context.links);
  if (places.length === 0) return formatCopy(context.locale, "bot.paidMissing", { brand: brandName });
  const normalized = normalizeName(brandName);
  const today = zonedDateISO(now, context.timezone);
  const paid = await withUser(userId, async (db) => {
    for (const place of places) {
      const rows = await listPaymentExpectations(db, place.workspaceId);
      const match = rows.find(
        (row) => isOpenPayment(row.status, row.dueDate, today) && normalizeName(row.brandName) === normalized,
      );
      if (!match) continue;
      const outstanding = outstandingMinor(match.amountMinor, match.receivedMinor);
      const amountMinor = outstanding > 0n ? outstanding : match.amountMinor;
      if (outstanding > 0n) {
        await recordReceipt(db, { userId, workspaceId: place.workspaceId }, match.id, {
          amount: minorToInput(outstanding),
          currency: match.currency,
          method: "other",
          note: "Marcado desde WhatsApp",
        });
      }
      await db.insert(activities).values({
        workspaceId: place.workspaceId,
        dealId: match.dealId,
        actorUserId: userId,
        type: "whatsapp_inbound",
        payload: { command: "cobré", brand: brandName, source: "whatsapp" },
      });
      return { brand: match.brandName, amountMinor, currency: match.currency };
    }
    return null;
  });
  if (!paid) return formatCopy(context.locale, "bot.paidMissing", { brand: brandName });
  return formatCopy(context.locale, "bot.paid", {
    brand: paid.brand,
    amount: formatMoney(paid.amountMinor, paid.currency, context.locale),
  });
}

export async function executeBotCommand(userId: string, command: BotCommand, now = new Date()): Promise<string> {
  const context = await linksFor(userId);
  const workspaceIds = context.links.map((link) => link.workspaceId);
  if (command.type === "help") return formatCopy(context.locale, "bot.help");
  if (command.type === "unsubscribe") {
    await revokeConsent(getJobsDb(), userId);
    return formatCopy(context.locale, "bot.unsubscribed");
  }
  if (command.type === "unparsed") return formatCopy(context.locale, "bot.unparsed");
  if (command.type === "today") {
    const [deliveries, payments] = await Promise.all([
      deliverableLines(userId, workspaceIds, context.locale, context.timezone, "today", now),
      paymentLines(userId, workspaceIds, context.locale, context.timezone, now),
    ]);
    const overdueLabel = formatCopy(context.locale, "labels.overdue");
    const overdue = payments.filter((line) => line.includes(overdueLabel));
    const lines = [...deliveries, ...overdue];
    if (lines.length === 0) return formatCopy(context.locale, "bot.hoyEmpty");
    return formatCopy(context.locale, "bot.hoy", { lines: clip(lines, context.locale) });
  }
  if (command.type === "week") {
    const lines = await deliverableLines(userId, workspaceIds, context.locale, context.timezone, "week", now);
    if (lines.length === 0) return formatCopy(context.locale, "bot.weekEmpty");
    return formatCopy(context.locale, "bot.week", { lines: clip(lines, context.locale) });
  }
  if (command.type === "payments") {
    const lines = await paymentLines(userId, workspaceIds, context.locale, context.timezone, now);
    if (lines.length === 0) return formatCopy(context.locale, "bot.paymentsEmpty");
    return formatCopy(context.locale, "bot.payments", { lines: clip(lines, context.locale) });
  }
  if (command.type === "pending") {
    const lines = await deliverableLines(userId, workspaceIds, context.locale, context.timezone, "open", now);
    if (lines.length === 0) return formatCopy(context.locale, "bot.pendingEmpty");
    return formatCopy(context.locale, "bot.pending", { lines: clip(lines, context.locale) });
  }
  if (command.type === "new_deal") return createDeal(userId, command);
  return markPaid(userId, command.brand, now);
}
