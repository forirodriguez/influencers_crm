import { INSTAGRAM_DEMOGRAPHICS_MIN_FOLLOWERS } from "../../integrations/instagram/adapter";

export const MANUAL_SYNC_INTERVAL_MS = 60 * 60 * 1000;
export const DAILY_SYNC_SKIP_MS = 20 * 60 * 60 * 1000;
export const INSTAGRAM_REFRESH_WINDOW_MS = 10 * 24 * 60 * 60 * 1000;
export const TIKTOK_REFRESH_WINDOW_MS = 6 * 60 * 60 * 1000;

export function canManualSync(lastSyncedAt: Date | null, now: Date): { ok: true } | { ok: false; retryAt: Date } {
  if (!lastSyncedAt) return { ok: true };
  const retryAt = new Date(lastSyncedAt.getTime() + MANUAL_SYNC_INTERVAL_MS);
  if (now.getTime() < retryAt.getTime()) return { ok: false, retryAt };
  return { ok: true };
}

export function shouldSkipDailySync(lastSyncedAt: Date | null, now: Date): boolean {
  if (!lastSyncedAt) return false;
  return now.getTime() - lastSyncedAt.getTime() < DAILY_SYNC_SKIP_MS;
}

export function demographicsForStorage<T>(followers: number | null, demographics: T | null): T | null {
  if (demographics === null) return null;
  if (followers === null || followers < INSTAGRAM_DEMOGRAPHICS_MIN_FOLLOWERS) return null;
  return demographics;
}

export function tokenDue(expiresAt: Date | null, now: Date, windowMs: number, graceMs: number): boolean {
  if (!expiresAt) return false;
  const delta = expiresAt.getTime() - now.getTime();
  return delta < windowMs && delta > -graceMs;
}
