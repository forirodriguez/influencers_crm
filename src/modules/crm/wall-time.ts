import { ApiError } from "../../lib/errors";

function offsetMs(instant: Date, timeZone: string): number {
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
  const hour = value("hour") % 24;
  const zoned = Date.UTC(value("year"), value("month") - 1, value("day"), hour, value("minute"), value("second"));
  return zoned - instant.getTime();
}

/** Interpreta una fecha de un input (sin zona) en la zona del usuario. */
export function parseUserDateTime(value: string, timeZone: string): Date {
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new ApiError("invalid_date", "La fecha no es válida", 400);
    return date;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value);
  if (!match) throw new ApiError("invalid_date", "La fecha no es válida", 400);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4] ?? "12");
  const minute = Number(match[5] ?? "0");
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let guess = wallAsUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    guess = wallAsUtc - offsetMs(new Date(guess), timeZone);
  }
  return new Date(guess);
}

export function formatWallInput(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  const hour = String(Number(value("hour")) % 24).padStart(2, "0");
  return `${value("year")}-${value("month")}-${value("day")}T${hour}:${value("minute")}`;
}
