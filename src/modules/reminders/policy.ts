import { MAX_WHATSAPP_PER_USER_PER_DAY } from "../../lib/constants";

export function zonedHour(now: Date, timeZone: string): number {
  const value = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  }).format(now);
  return Number(value);
}

export function isQuietHours(now: Date, timeZone: string): boolean {
  const hour = zonedHour(now, timeZone);
  return hour >= 21 || hour < 8;
}

export function canSendWhatsApp(input: { now: Date; timeZone: string; sentToday: number }): {
  ok: boolean;
  reason?: "quiet_hours" | "daily_cap";
} {
  if (isQuietHours(input.now, input.timeZone)) return { ok: false, reason: "quiet_hours" };
  if (input.sentToday >= MAX_WHATSAPP_PER_USER_PER_DAY) return { ok: false, reason: "daily_cap" };
  return { ok: true };
}
