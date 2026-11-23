import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type OAuthPayload = {
  provider: "instagram" | "tiktok";
  profileId: string;
  userId: string;
  workspaceId: string;
  nonce: string;
  codeVerifier: string | null;
  exp: number;
};

const MAX_AGE_SECONDS = 10 * 60;

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 16) throw new Error("AUTH_SECRET debe tener al menos 16 caracteres");
  return value;
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function createPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function issueOAuthState(input: Omit<OAuthPayload, "nonce" | "exp">, now = Date.now()): { cookie: string; nonce: string } {
  const payload: OAuthPayload = {
    ...input,
    nonce: randomBytes(16).toString("base64url"),
    exp: Math.floor(now / 1000) + MAX_AGE_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return { cookie: `${body}.${sign(body)}`, nonce: payload.nonce };
}

export function readOAuthState(cookie: string | undefined, now = Date.now()): OAuthPayload | null {
  if (!cookie) return null;
  const [body, signature] = cookie.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthPayload;
    if (!payload.profileId || !payload.userId || !payload.workspaceId || !payload.nonce) return null;
    if (payload.provider !== "instagram" && payload.provider !== "tiktok") return null;
    if (payload.exp * 1000 <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

export const OAUTH_COOKIE = "icrm_oauth";
export const OAUTH_MAX_AGE_SECONDS = MAX_AGE_SECONDS;
