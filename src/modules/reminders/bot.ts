import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { getJobsDb } from "../../db/client";
import { zonedDateISO } from "../../lib/dates";
import { getEnv } from "../../lib/env.server";
import { formatMoney } from "../../lib/money";
import { normalizeName } from "../../lib/names";
import { activities, brands, deals, deliverables, paymentExpectations, paymentsReceived, pipelineStages } from "../crm/schema";
import { memberships, users, workspaces } from "../identity/schema";
import { creatorProfiles } from "../media-kit/schema";
import type { BotCommand } from "./commands";
import { revokeConsent } from "./consent";
import { formatCopy } from "./copy";
import { addDaysISO } from "./time";

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

async function linksFor(userId: string): Promise<{ locale: string; timezone: string; name: string | null; links: WorkspaceLink[] }> {
  const db = getJobsDb();
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
  return { locale: user.locale, timezone: user.timezone, name: user.name, links: rows };
}

function writable(links: WorkspaceLink[]): WorkspaceLink[] {
  return links.filter((link) => link.role === "owner" || link.role === "manager");
}

function homeWorkspace(links: WorkspaceLink[]): WorkspaceLink | null {
  return links.find((link) => link.type === "personal" && link.role === "owner") ?? writable(links)[0] ?? null;
}

async function deliverableLines(workspaceIds: string[], locale: string, timezone: string, filter: "today" | "week" | "open", now: Date) {
  if (workspaceIds.length === 0) return [];
  const today = zonedDateISO(now, timezone);
  const weekEnd = addDaysISO(today, 6);
  const rows = await getJobsDb()
    .select({
      title: deals.title,
      brandName: brands.name,
      status: deliverables.status,
      publishDueAt: deliverables.publishDueAt,
      approvalDueAt: deliverables.approvalDueAt,
      draftDueAt: deliverables.draftDueAt,
    })
    .from(deliverables)
    .innerJoin(deals, eq(deals.id, deliverables.dealId))
    .innerJoin(brands, eq(brands.id, deals.brandId))
    .where(and(inArray(deliverables.workspaceId, workspaceIds), isNull(deliverables.deletedAt), isNull(deals.deletedAt)))
    .orderBy(asc(deliverables.publishDueAt))
    .limit(30);
  const lines: string[] = [];
  for (const row of rows) {
    if (row.status === "published" || row.status === "cancelled") continue;
    const anchor = row.publishDueAt ?? row.approvalDueAt ?? row.draftDueAt;
    const local = anchor ? zonedDateISO(anchor, timezone) : "";
    if (filter === "today" && local !== today) continue;
    if (filter === "week" && (!local || local < today || local > weekEnd)) continue;
    const date = local || "sin fecha";
    lines.push(formatCopy(locale, "bot.lineDeliverable", { brand: row.brandName, title: row.title, date }));
  }
  return lines;
}

async function paymentLines(workspaceIds: string[], locale: string) {
  if (workspaceIds.length === 0) return [];
  const rows = await getJobsDb()
    .select({
      brandName: brands.name,
      amountMinor: paymentExpectations.amountMinor,
      currency: paymentExpectations.currency,
      dueDate: paymentExpectations.dueDate,
      status: paymentExpectations.status,
    })
    .from(paymentExpectations)
    .innerJoin(deals, eq(deals.id, paymentExpectations.dealId))
    .innerJoin(brands, eq(brands.id, deals.brandId))
    .where(
      and(
        inArray(paymentExpectations.workspaceId, workspaceIds),
        inArray(paymentExpectations.status, ["pending", "overdue", "partial"]),
        isNull(paymentExpectations.deletedAt),
      ),
    )
    .orderBy(asc(paymentExpectations.dueDate))
    .limit(30);
  return rows.map((row) =>
    formatCopy(locale, "bot.linePayment", {
      brand: row.brandName,
      amount: formatMoney(row.amountMinor, row.currency, locale),
      status: formatCopy(locale, `labels.${row.status}`),
      date: row.dueDate,
    }),
  );
}

async function createDeal(userId: string, command: Extract<BotCommand, { type: "new_deal" }>, now: Date): Promise<string> {
  const context = await linksFor(userId);
  const workspace = homeWorkspace(context.links);
  if (!workspace) return formatCopy(context.locale, "bot.needProfile");
  const db = getJobsDb();
  const profiles = await db
    .select()
    .from(creatorProfiles)
    .where(and(eq(creatorProfiles.workspaceId, workspace.workspaceId), isNull(creatorProfiles.deletedAt)));
  const chosen = profiles.find((item) => item.userId === userId) ?? profiles[0];
  if (!chosen) return formatCopy(context.locale, "bot.needProfile");
  const [stage] = await db
    .select()
    .from(pipelineStages)
    .where(and(eq(pipelineStages.workspaceId, workspace.workspaceId), eq(pipelineStages.kind, "open"), isNull(pipelineStages.deletedAt)))
    .orderBy(asc(pipelineStages.position))
    .limit(1);
  if (!stage) return formatCopy(context.locale, "bot.needProfile");
  const normalized = normalizeName(command.brand);
  const [existingBrand] = await db
    .select()
    .from(brands)
    .where(and(eq(brands.workspaceId, workspace.workspaceId), eq(brands.nameNormalized, normalized), isNull(brands.deletedAt)))
    .limit(1);
  const brand = existingBrand
    ? existingBrand
    : (
        await db
          .insert(brands)
          .values({ workspaceId: workspace.workspaceId, name: command.brand, nameNormalized: normalized })
          .returning()
      )[0];
  if (!brand) return formatCopy(context.locale, "bot.needProfile");
  const [deal] = await db
    .insert(deals)
    .values({
      workspaceId: workspace.workspaceId,
      creatorProfileId: chosen.id,
      brandId: brand.id,
      stageId: stage.id,
      title: `Acuerdo con ${command.brand}`.slice(0, 160),
      compensationType: "paid",
      amountMinor: command.amountMinor,
      currency: command.currency,
      source: "whatsapp",
      notes: "Creado por el comando nuevo de WhatsApp.",
      createdBy: userId,
    })
    .returning();
  if (!deal) return formatCopy(context.locale, "bot.needProfile");
  const dueDate = addDaysISO(zonedDateISO(now, context.timezone), 30);
  await db.insert(paymentExpectations).values({
    dealId: deal.id,
    workspaceId: workspace.workspaceId,
    amountMinor: command.amountMinor,
    currency: command.currency,
    dueDate,
    status: "pending",
    note: "Creado por WhatsApp",
  });
  await db.insert(activities).values({
    workspaceId: workspace.workspaceId,
    dealId: deal.id,
    actorUserId: userId,
    type: "whatsapp_inbound",
    payload: { command: "nuevo", brand: command.brand },
  });
  return formatCopy(context.locale, "bot.created", {
    brand: command.brand,
    amount: formatMoney(command.amountMinor, command.currency, context.locale),
    url: appUrl(`/acuerdos/${deal.id}`),
  });
}

async function markPaid(userId: string, brandName: string, now: Date): Promise<string> {
  const context = await linksFor(userId);
  const places = writable(context.links);
  if (places.length === 0) return formatCopy(context.locale, "bot.paidMissing", { brand: brandName });
  const normalized = normalizeName(brandName);
  const db = getJobsDb();
  const rows = await db
    .select({
      id: paymentExpectations.id,
      dealId: paymentExpectations.dealId,
      workspaceId: paymentExpectations.workspaceId,
      amountMinor: paymentExpectations.amountMinor,
      currency: paymentExpectations.currency,
      dueDate: paymentExpectations.dueDate,
      brandName: brands.name,
      nameNormalized: brands.nameNormalized,
    })
    .from(paymentExpectations)
    .innerJoin(deals, eq(deals.id, paymentExpectations.dealId))
    .innerJoin(brands, eq(brands.id, deals.brandId))
    .where(
      and(
        inArray(paymentExpectations.workspaceId, places.map((place) => place.workspaceId)),
        inArray(paymentExpectations.status, ["pending", "overdue", "partial"]),
        isNull(paymentExpectations.deletedAt),
      ),
    )
    .orderBy(asc(paymentExpectations.dueDate));
  const match = rows.find((row) => row.nameNormalized === normalized || normalizeName(row.brandName) === normalized);
  if (!match) return formatCopy(context.locale, "bot.paidMissing", { brand: brandName });
  const receipts = await db
    .select({ amountMinor: paymentsReceived.amountMinor })
    .from(paymentsReceived)
    .where(and(eq(paymentsReceived.paymentExpectationId, match.id), isNull(paymentsReceived.deletedAt)));
  const received = receipts.reduce((sum, row) => sum + row.amountMinor, 0n);
  const outstanding = match.amountMinor > received ? match.amountMinor - received : 0n;
  if (outstanding > 0n) {
    await db.insert(paymentsReceived).values({
      paymentExpectationId: match.id,
      workspaceId: match.workspaceId,
      amountMinor: outstanding,
      currency: match.currency,
      receivedAt: now,
      method: "other",
      note: "Marcado desde WhatsApp",
    });
  }
  await db.update(paymentExpectations).set({ status: "paid" }).where(eq(paymentExpectations.id, match.id));
  await db.insert(activities).values({
    workspaceId: match.workspaceId,
    dealId: match.dealId,
    actorUserId: userId,
    type: "payment_marked",
    payload: { command: "cobré", brand: brandName, source: "whatsapp" },
  });
  return formatCopy(context.locale, "bot.paid", {
    brand: match.brandName,
    amount: formatMoney(outstanding > 0n ? outstanding : match.amountMinor, match.currency, context.locale),
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
      deliverableLines(workspaceIds, context.locale, context.timezone, "today", now),
      paymentLines(workspaceIds, context.locale),
    ]);
    const overdue = payments.filter((line) => line.includes(formatCopy(context.locale, "labels.overdue")));
    const lines = [...deliveries, ...overdue];
    if (lines.length === 0) return formatCopy(context.locale, "bot.hoyEmpty");
    return formatCopy(context.locale, "bot.hoy", { lines: clip(lines, context.locale) });
  }
  if (command.type === "week") {
    const lines = await deliverableLines(workspaceIds, context.locale, context.timezone, "week", now);
    if (lines.length === 0) return formatCopy(context.locale, "bot.weekEmpty");
    return formatCopy(context.locale, "bot.week", { lines: clip(lines, context.locale) });
  }
  if (command.type === "payments") {
    const lines = await paymentLines(workspaceIds, context.locale);
    if (lines.length === 0) return formatCopy(context.locale, "bot.paymentsEmpty");
    return formatCopy(context.locale, "bot.payments", { lines: clip(lines, context.locale) });
  }
  if (command.type === "pending") {
    const lines = await deliverableLines(workspaceIds, context.locale, context.timezone, "open", now);
    if (lines.length === 0) return formatCopy(context.locale, "bot.pendingEmpty");
    return formatCopy(context.locale, "bot.pending", { lines: clip(lines, context.locale) });
  }
  if (command.type === "new_deal") return createDeal(userId, command, now);
  return markPaid(userId, command.brand, now);
}
