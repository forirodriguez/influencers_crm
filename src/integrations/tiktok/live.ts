import { createHash } from "node:crypto";
import { IntegrationNotConfigured, SocialApiError } from "../../lib/errors";
import {
  TIKTOK_SCOPES,
  TIKTOK_TOKEN_URL,
  TIKTOK_USER_FIELDS,
  TIKTOK_USER_INFO_URL,
  TIKTOK_VIDEO_FIELDS,
  TIKTOK_VIDEO_LIST_URL,
  TIKTOK_VIDEO_PAGE_SIZE,
  buildTikTokAuthorizeUrl,
  type TikTokAdapter,
  type TikTokProfile,
  type TikTokToken,
  type TikTokVideo,
} from "./adapter";
type HttpClient = (url: string, init?: RequestInit) => Promise<Response>;

export function tiktokErrorCode(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (typeof record.error === "string" && record.error.length > 0) return record.error;
  if (record.error && typeof record.error === "object") {
    const code = (record.error as { code?: unknown }).code;
    if (typeof code === "string" && code !== "ok") return code;
  }
  return null;
}

export function isTikTokRateLimited(status: number, body: unknown): boolean {
  return status === 429 || tiktokErrorCode(body) === "rate_limit_exceeded";
}

export function isTikTokTokenExpired(status: number, body: unknown): boolean {
  const code = tiktokErrorCode(body);
  return status === 401 || code === "access_token_invalid" || code === "invalid_grant";
}

export function parseTikTokToken(body: unknown): TikTokToken | null {
  if (!body || typeof body !== "object") return null;
  if (tiktokErrorCode(body)) return null;
  const record = body as Record<string, unknown>;
  const nested = record.data && typeof record.data === "object" ? (record.data as Record<string, unknown>) : record;
  const accessToken = nested.access_token;
  if (typeof accessToken !== "string" || accessToken.length === 0) return null;
  const expiresIn = typeof nested.expires_in === "number" ? nested.expires_in : null;
  const scope = typeof nested.scope === "string" ? nested.scope.split(",").map((item) => item.trim()).filter(Boolean) : [...TIKTOK_SCOPES];
  return {
    accessToken,
    refreshToken: typeof nested.refresh_token === "string" ? nested.refresh_token : null,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
    externalId: typeof nested.open_id === "string" ? nested.open_id : null,
    scopes: scope,
  };
}

export function handleFromDisplayName(name: string, fallback: string): string {
  const cleaned = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, "")
    .slice(0, 30);
  return cleaned || fallback;
}

export function parseTikTokUser(body: unknown): TikTokProfile | null {
  if (!body || typeof body !== "object") return null;
  const data = (body as { data?: { user?: unknown } }).data?.user;
  if (!data || typeof data !== "object") return null;
  const user = data as Record<string, unknown>;
  const externalId = typeof user.open_id === "string" ? user.open_id : "";
  if (!externalId) return null;
  const displayName = typeof user.display_name === "string" ? user.display_name : "";
  return {
    externalId,
    handle: handleFromDisplayName(displayName, `tt${externalId.slice(-6)}`),
    avatarUrl: typeof user.avatar_url === "string" ? user.avatar_url : null,
    followers: numberValue(user.follower_count),
    following: numberValue(user.following_count),
    likesTotal: numberValue(user.likes_count),
    videoCount: numberValue(user.video_count),
  };
}

export function parseTikTokVideos(body: unknown): TikTokVideo[] {
  if (!body || typeof body !== "object") return [];
  const videos = (body as { data?: { videos?: unknown } }).data?.videos;
  if (!Array.isArray(videos)) return [];
  return videos.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const video = item as Record<string, unknown>;
    if (typeof video.id !== "string") return [];
    const created = typeof video.create_time === "number" ? new Date(video.create_time * 1000).toISOString() : null;
    return [
      {
        externalId: video.id,
        url: typeof video.share_url === "string" ? video.share_url : null,
        thumbnailUrl: typeof video.cover_image_url === "string" ? video.cover_image_url : null,
        publishedAt: created,
        views: numberValue(video.view_count),
        likes: numberValue(video.like_count),
        comments: numberValue(video.comment_count),
        shares: numberValue(video.share_count),
      },
    ];
  });
}

export class LiveTikTokAdapter implements TikTokAdapter {
  private readonly fetchImpl: HttpClient;

  constructor(private readonly options: { clientKey?: string; clientSecret?: string; fetch?: HttpClient } = {}) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  private clientKey(): string {
    const value = this.options.clientKey || process.env.TIKTOK_CLIENT_KEY;
    if (!value) throw new IntegrationNotConfigured("tiktok", "Falta TIKTOK_CLIENT_KEY");
    return value;
  }

  private clientSecret(): string {
    const value = this.options.clientSecret || process.env.TIKTOK_CLIENT_SECRET;
    if (!value) throw new IntegrationNotConfigured("tiktok", "Falta TIKTOK_CLIENT_SECRET");
    return value;
  }

  getAuthorizationUrl(input: { state: string; redirectUri: string; codeChallenge: string }): string {
    return buildTikTokAuthorizeUrl({
      clientKey: this.clientKey(),
      redirectUri: input.redirectUri,
      state: input.state,
      codeChallenge: input.codeChallenge,
    });
  }

  async exchangeCode(input: { code: string; codeVerifier: string; redirectUri: string }): Promise<TikTokToken> {
    return this.requestToken({
      client_key: this.clientKey(),
      client_secret: this.clientSecret(),
      code: input.code,
      grant_type: "authorization_code",
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
    });
  }

  async refreshAccessToken(refreshToken: string): Promise<TikTokToken> {
    return this.requestToken({
      client_key: this.clientKey(),
      client_secret: this.clientSecret(),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
  }

  async fetchProfile(accessToken: string): Promise<TikTokProfile> {
    const url = new URL(TIKTOK_USER_INFO_URL);
    url.searchParams.set("fields", TIKTOK_USER_FIELDS);
    const body = await this.getJson(url.toString(), accessToken);
    const profile = parseTikTokUser(body);
    if (!profile) throw new SocialApiError("tiktok", "upstream", "TikTok no devolvió el perfil", 502);
    return profile;
  }

  async fetchRecentVideos(accessToken: string): Promise<TikTokVideo[]> {
    const url = new URL(TIKTOK_VIDEO_LIST_URL);
    url.searchParams.set("fields", TIKTOK_VIDEO_FIELDS);
    try {
      const body = await this.postJson(url.toString(), accessToken, { max_count: TIKTOK_VIDEO_PAGE_SIZE });
      return parseTikTokVideos(body).slice(0, TIKTOK_VIDEO_PAGE_SIZE);
    } catch (error) {
      if (error instanceof SocialApiError && error.code === "rate_limited") return [];
      throw error;
    }
  }

  private async requestToken(fields: Record<string, string>): Promise<TikTokToken> {
    const body = new URLSearchParams(fields);
    const response = await this.fetchImpl(TIKTOK_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(12_000),
    });
    const payload = await readBody(response);
    this.assertOk(response.status, payload);
    const token = parseTikTokToken(payload);
    if (!token) throw new SocialApiError("tiktok", "upstream", "TikTok no devolvió un access token", 502);
    return token;
  }

  private async getJson(url: string, accessToken: string): Promise<unknown> {
    const response = await this.fetchImpl(url, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(12_000),
    });
    const body = await readBody(response);
    this.assertOk(response.status, body);
    return body;
  }

  private async postJson(url: string, accessToken: string, payload: unknown): Promise<unknown> {
    const response = await this.fetchImpl(url, {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12_000),
    });
    const body = await readBody(response);
    this.assertOk(response.status, body);
    return body;
  }

  private assertOk(status: number, body: unknown): void {
    const code = tiktokErrorCode(body);
    if (status >= 200 && status < 300 && !code) return;
    if (isTikTokRateLimited(status, body)) {
      throw new SocialApiError("tiktok", "rate_limited", "TikTok limitó las consultas (600 por minuto)", 429);
    }
    if (isTikTokTokenExpired(status, body)) {
      throw new SocialApiError("tiktok", "expired", "El acceso a TikTok venció", 401);
    }
    throw new SocialApiError("tiktok", "upstream", code ?? `TikTok respondió ${status}`, status || 502);
  }
}

export function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text.slice(0, 200) };
  }
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
