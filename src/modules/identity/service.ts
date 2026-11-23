import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { withAdmin, withUser } from "../../db/client";
import type { Db } from "../../db/types";
import { COUNTRY_PRESETS, LEGAL_VERSION, MX_TIMEZONES, isLocale, type AppLocale, type CurrencyCode } from "../../lib/constants";
import { ApiError, isUniqueViolation } from "../../lib/errors";
import { getEnv } from "../../lib/env.server";
import { rateLimit } from "../../lib/rate-limit";
import { createSessionToken } from "../../lib/session";
import { isReservedSlug, slugify } from "../../lib/slug";
import { getEmailAdapter } from "../../integrations";
import { creatorProfiles } from "../media-kit/schema";
import { createWorkspaceWithOwner } from "./bootstrap";
import { hashPassword, verifyPassword } from "./password";
import { authCredentials, invitations, legalAcceptances, magicLinks, memberships, users, workspaces } from "./schema";

export type CountryChoice = keyof typeof COUNTRY_PRESETS;

const countrySchema = new Set<CountryChoice>(["AR", "MX", "CO", "UY", "OTHER"]);

export type AuthResult = {
  token: string;
  userId: string;
  workspaceId: string;
  locale: AppLocale;
  needsOnboarding: boolean;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function presetFor(country: CountryChoice) {
  return COUNTRY_PRESETS[country];
}

function assertCountry(value: unknown): CountryChoice {
  if (typeof value !== "string" || !countrySchema.has(value as CountryChoice)) {
    throw new ApiError("invalid_country", "Elegí un país", 400);
  }
  return value as CountryChoice;
}

function timezoneFor(country: CountryChoice, requested?: string): string {
  if (country === "MX") {
    if (!requested) return COUNTRY_PRESETS.MX.timezone;
    if (!(MX_TIMEZONES as readonly string[]).includes(requested)) {
      throw new ApiError("invalid_timezone", "Esa zona horaria no está en la lista de México", 400);
    }
    return requested;
  }
  return presetFor(country).timezone;
}

async function uniqueSlug(db: Db, displayName: string): Promise<string> {
  const base = slugify(displayName);
  let candidate = isReservedSlug(base) ? `${base}-creator` : base;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const existing = await db
      .select({ id: creatorProfiles.id })
      .from(creatorProfiles)
      .where(eq(creatorProfiles.slug, candidate))
      .limit(1);
    if (existing.length === 0 && !isReservedSlug(candidate)) return candidate;
    candidate = `${base}-${randomBytes(2).toString("hex")}`;
  }
  return `${base}-${randomBytes(4).toString("hex")}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function currencyForStoredCountry(country: string | null): CurrencyCode {
  if (country === "AR" || country === "MX" || country === "CO" || country === "UY") {
    return COUNTRY_PRESETS[country].currency;
  }
  return "USD";
}

export async function registerWithPassword(input: {
  name: string;
  email: string;
  password: string;
  country: CountryChoice;
  timezone?: string;
  acceptTerms: boolean;
  ip?: string;
}): Promise<AuthResult> {
  if (input.acceptTerms !== true) {
    throw new ApiError("terms_required", "Tenés que aceptar los términos y la privacidad", 400);
  }
  const name = input.name.trim();
  if (name.length < 2) throw new ApiError("invalid_name", "El nombre es muy corto", 400);
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError("invalid_email", "El email no es válido", 400);
  if (input.password.length < 8) throw new ApiError("weak_password", "La contraseña necesita al menos 8 caracteres", 400);
  const country = assertCountry(input.country);
  const preset = presetFor(country);
  const timezone = timezoneFor(country, input.timezone);
  const countryCode = country === "OTHER" ? null : country;
  const passwordHash = await hashPassword(input.password);

  try {
    const created = await withAdmin(async (db) => {
      const [user] = await db
        .insert(users)
        .values({
          email,
          name,
          locale: preset.locale,
          timezone,
          country: countryCode,
        })
        .returning({ id: users.id });
      if (!user) throw new Error("No se pudo crear el usuario");
      await db.insert(authCredentials).values({ userId: user.id, passwordHash });
      await db.insert(legalAcceptances).values([
        { userId: user.id, document: "terms", version: LEGAL_VERSION, ip: input.ip ?? null },
        { userId: user.id, document: "privacy", version: LEGAL_VERSION, ip: input.ip ?? null },
      ]);
      const slug = await uniqueSlug(db, name);
      const workspace = await createWorkspaceWithOwner(db, {
        ownerId: user.id,
        name,
        type: "personal",
        country: countryCode,
        currency: preset.currency,
        profile: {
          displayName: name,
          slug,
          country: countryCode,
          publicEmail: email,
          niches: [],
          languages: ["es"],
        },
      });
      return { userId: user.id, workspaceId: workspace.workspaceId, locale: preset.locale };
    });
    return {
      token: await createSessionToken(created.userId),
      userId: created.userId,
      workspaceId: created.workspaceId,
      locale: created.locale,
      needsOnboarding: false,
    };
  } catch (error) {
    if (isUniqueViolation(error)) throw new ApiError("email_taken", "Ese email ya tiene cuenta", 409);
    throw error;
  }
}

export async function loginWithPassword(input: { email: string; password: string; ip?: string }): Promise<AuthResult> {
  const email = normalizeEmail(input.email ?? "");
  const ip = input.ip ?? "local";
  if (!rateLimit(`login:${ip}:${email}`, 10, 15 * 60 * 1000)) {
    throw new ApiError("rate_limited", "Demasiados intentos. Probá de nuevo en unos minutos", 429);
  }
  const invalid = new ApiError("invalid_credentials", "Email o contraseña incorrectos", 401);
  const found = await withAdmin(async (db) => {
    const [user] = await db.select().from(users).where(and(eq(users.email, email), isNull(users.deletedAt))).limit(1);
    if (!user) return null;
    const [credentials] = await db.select().from(authCredentials).where(eq(authCredentials.userId, user.id)).limit(1);
    return { user, passwordHash: credentials?.passwordHash ?? null };
  });
  if (!found?.passwordHash || !(await verifyPassword(input.password ?? "", found.passwordHash))) throw invalid;
  const workspaceId = await firstWorkspaceId(found.user.id);
  return {
    token: await createSessionToken(found.user.id),
    userId: found.user.id,
    workspaceId,
    locale: isLocale(found.user.locale) ? found.user.locale : "es-AR",
    needsOnboarding: !found.user.country,
  };
}

async function firstWorkspaceId(userId: string): Promise<string> {
  const rows = await withAdmin(async (db) =>
    db
      .select({ id: workspaces.id })
      .from(memberships)
      .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
      .where(and(eq(memberships.userId, userId), isNull(memberships.deletedAt)))
      .limit(1),
  );
  const workspace = rows[0];
  if (!workspace) throw new ApiError("no_workspace", "La cuenta no tiene workspace", 500);
  return workspace.id;
}

export async function requestMagicLink(emailInput: string, ip?: string): Promise<{ devLink?: string }> {
  const email = normalizeEmail(emailInput);
  if (!rateLimit(`magic:${ip ?? "local"}:${email}`, 5, 15 * 60 * 1000)) {
    throw new ApiError("rate_limited", "Demasiados links. Esperá un rato", 429);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError("invalid_email", "El email no es válido", 400);
  const token = randomBytes(32).toString("base64url");
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await withAdmin(async (db) => {
    await db.insert(magicLinks).values({ email, tokenHash, expiresAt });
  });
  const env = getEnv();
  const link = `${env.NEXT_PUBLIC_APP_URL}/api/v1/auth/magic-link/verify?token=${encodeURIComponent(token)}`;
  await getEmailAdapter().send({
    to: email,
    subject: "Tu link para entrar a influencers_crm",
    text: `Entrá con este link en los próximos 30 minutos: ${link}`,
    html: `<p>Entrá con este link en los próximos 30 minutos:</p><p><a href="${link}">${link}</a></p>`,
  });
  return env.AUTH_DEV_EXPOSE_LINKS === "true" ? { devLink: link } : {};
}

export async function consumeMagicLink(token: string): Promise<AuthResult> {
  const tokenHash = sha256(token);
  const consumed = await withAdmin(async (db) => {
    const [link] = await db.select().from(magicLinks).where(eq(magicLinks.tokenHash, tokenHash)).limit(1);
    if (!link || link.usedAt || link.expiresAt.getTime() < Date.now()) return null;
    await db.update(magicLinks).set({ usedAt: new Date() }).where(eq(magicLinks.id, link.id));
    const [existing] = await db.select().from(users).where(and(eq(users.email, link.email), isNull(users.deletedAt))).limit(1);
    if (existing) return existing;
    const [created] = await db
      .insert(users)
      .values({ email: link.email, name: link.email.split("@")[0] ?? "Creator", country: null })
      .returning();
    if (!created) throw new Error("No se pudo crear el usuario");
    const slug = await uniqueSlug(db, created.name ?? "creator");
    await createWorkspaceWithOwner(db, {
      ownerId: created.id,
      name: created.name ?? "Mi espacio",
      type: "personal",
      country: null,
      currency: "ARS",
      profile: { displayName: created.name ?? "Creator", slug, country: null, publicEmail: created.email },
    });
    return created;
  });
  if (!consumed) throw new ApiError("invalid_link", "El link venció o ya se usó", 400);
  const workspaceId = await firstWorkspaceId(consumed.id);
  return {
    token: await createSessionToken(consumed.id),
    userId: consumed.id,
    workspaceId,
    locale: isLocale(consumed.locale) ? consumed.locale : "es-AR",
    needsOnboarding: !consumed.country,
  };
}

export async function updateProfile(
  userId: string,
  input: { name?: string; locale?: string; timezone?: string; country?: CountryChoice; phoneE164?: string | null },
): Promise<void> {
  const patch: Partial<typeof users.$inferInsert> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < 2) throw new ApiError("invalid_name", "El nombre es muy corto", 400);
    patch.name = name;
  }
  if (input.locale !== undefined) {
    if (!isLocale(input.locale)) throw new ApiError("invalid_locale", "Idioma no soportado", 400);
    patch.locale = input.locale;
  }
  if (input.timezone !== undefined) patch.timezone = input.timezone;
  if (input.country !== undefined) {
    const country = assertCountry(input.country);
    patch.country = country === "OTHER" ? null : country;
  }
  if (input.phoneE164 !== undefined) patch.phoneE164 = input.phoneE164;
  await withUser(userId, async (db) => {
    await db.update(users).set(patch).where(eq(users.id, userId));
  });
}

export async function completeOnboarding(
  userId: string,
  workspaceId: string,
  input: { country: CountryChoice; timezone?: string },
): Promise<{ locale: AppLocale; currency: CurrencyCode }> {
  const country = assertCountry(input.country);
  const preset = presetFor(country);
  const timezone = timezoneFor(country, input.timezone);
  const countryCode = country === "OTHER" ? null : country;
  await withUser(userId, async (db) => {
    const [membership] = await db
      .select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.workspaceId, workspaceId), isNull(memberships.deletedAt)))
      .limit(1);
    if (!membership || membership.role !== "owner") {
      throw new ApiError("forbidden", "Solo el titular puede terminar el onboarding de este espacio", 403);
    }
    await db.update(users).set({ country: countryCode, timezone, locale: preset.locale }).where(eq(users.id, userId));
    await db
      .update(workspaces)
      .set({ country: countryCode, defaultCurrency: preset.currency })
      .where(eq(workspaces.id, workspaceId));
    await db
      .update(creatorProfiles)
      .set({ country: countryCode })
      .where(and(eq(creatorProfiles.workspaceId, workspaceId), eq(creatorProfiles.userId, userId)));
  });
  return { locale: preset.locale, currency: preset.currency };
}

export async function createAgencyWorkspace(userId: string, name: string): Promise<{ workspaceId: string }> {
  const trimmed = name.trim();
  if (trimmed.length < 2) throw new ApiError("invalid_name", "El nombre del espacio es muy corto", 400);
  const [owner] = await withAdmin(async (db) => db.select().from(users).where(eq(users.id, userId)).limit(1));
  if (!owner) throw new ApiError("unauthorized", "Tenés que iniciar sesión", 401);
  const created = await withAdmin(async (db) =>
    createWorkspaceWithOwner(db, {
      ownerId: userId,
      name: trimmed,
      type: "agency",
      country: owner.country,
      currency: currencyForStoredCountry(owner.country),
    }),
  );
  return { workspaceId: created.workspaceId };
}

export async function createInvitation(input: {
  userId: string;
  workspaceId: string;
  email: string;
  role: "manager" | "viewer";
}): Promise<{ invitationId: string; token: string }> {
  if (input.role !== "manager" && input.role !== "viewer") {
    throw new ApiError("invalid_role", "El rol tiene que ser manager o viewer", 400);
  }
  const email = normalizeEmail(input.email);
  const token = randomBytes(32).toString("base64url");
  const tokenHash = sha256(token);
  const invitationId = await withUser(input.userId, async (db) => {
    const [membership] = await db
      .select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.userId, input.userId), eq(memberships.workspaceId, input.workspaceId), isNull(memberships.deletedAt)))
      .limit(1);
    if (!membership) throw new ApiError("forbidden", "No pertenecés a este espacio", 403);
    if (membership.role !== "owner") throw new ApiError("forbidden", "Solo el titular puede invitar", 403);
    const [row] = await db
      .insert(invitations)
      .values({
        workspaceId: input.workspaceId,
        email,
        role: input.role,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })
      .returning({ id: invitations.id });
    if (!row) throw new Error("No se pudo crear la invitación");
    return row.id;
  });
  return { invitationId, token };
}

export async function acceptInvitation(userId: string, token: string): Promise<{ workspaceId: string }> {
  const tokenHash = sha256(token);
  return withAdmin(async (db) => {
    const [invite] = await db.select().from(invitations).where(eq(invitations.tokenHash, tokenHash)).limit(1);
    if (!invite || invite.deletedAt || invite.acceptedAt || invite.expiresAt.getTime() < Date.now()) {
      throw new ApiError("invalid_invitation", "La invitación venció o ya se usó", 400);
    }
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || user.email !== invite.email) {
      throw new ApiError("forbidden", "Esta invitación es para otro email", 403);
    }
    await db.insert(memberships).values({
      workspaceId: invite.workspaceId,
      userId,
      role: invite.role,
      acceptedAt: new Date(),
    });
    await db.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, invite.id));
    return { workspaceId: invite.workspaceId };
  });
}
