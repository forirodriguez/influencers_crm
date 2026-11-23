import { zonedDateISO } from "../../lib/dates";

export const REMINDER_LOOKBACK_MS = 26 * 60 * 60 * 1000;
export const WHATSAPP_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
export const ACCOUNT_PURGE_MS = 30 * 24 * 60 * 60 * 1000;

export function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
  return asUtc - instant.getTime();
}

export function zonedDateTimeToUtc(isoDate: string, hour: number, minute: number, timeZone: string): Date {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) throw new Error(`Fecha inválida: ${isoDate}`);
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offset = timeZoneOffsetMs(guess, timeZone);
  const corrected = new Date(guess.getTime() - offset);
  const again = timeZoneOffsetMs(corrected, timeZone);
  return again === offset ? corrected : new Date(guess.getTime() - again);
}

export function addDaysISO(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days)).toISOString().slice(0, 10);
}

export function localDayBounds(now: Date, timeZone: string): { start: Date; end: Date } {
  const iso = zonedDateISO(now, timeZone);
  return {
    start: zonedDateTimeToUtc(iso, 0, 0, timeZone),
    end: zonedDateTimeToUtc(addDaysISO(iso, 1), 0, 0, timeZone),
  };
}

export function weekdayInZone(now: Date, timeZone: string): number {
  const value = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(now);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[value] ?? 0;
}

export function occurrenceInWindow(anchor: Date, offsetMinutes: number, now: Date): Date | null {
  const first = new Date(anchor.getTime() + offsetMinutes * 60_000);
  if (offsetMinutes <= 0) {
    if (first.getTime() > now.getTime()) return null;
    if (now.getTime() - first.getTime() > REMINDER_LOOKBACK_MS) return null;
    return first;
  }
  if (now.getTime() < first.getTime()) return null;
  const stepMs = offsetMinutes * 60_000;
  const steps = Math.floor((now.getTime() - first.getTime()) / stepMs);
  const occurrence = new Date(first.getTime() + steps * stepMs);
  if (now.getTime() - occurrence.getTime() > REMINDER_LOOKBACK_MS) return null;
  return occurrence;
}

export function slotFor(entity: "deliverable" | "payment", offsetMinutes: number): string {
  if (entity === "deliverable" && offsetMinutes === -2880) return "due-48h";
  if (offsetMinutes === 0) return "due-0";
  if (entity === "payment" && offsetMinutes === 10080) return "overdue-7d";
  return `offset-${offsetMinutes}`;
}

export function reminderKey(input: {
  entity: string;
  entityId: string;
  slot: string;
  occurrence: Date;
  channel: string;
  userId: string;
}): string {
  return `${input.entity}:${input.entityId}:${input.slot}:${input.occurrence.toISOString().slice(0, 16)}:${input.channel}:${input.userId}`;
}
