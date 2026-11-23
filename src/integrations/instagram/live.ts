import { IntegrationNotConfigured, SocialApiError } from "../../lib/errors";
import {
  INSTAGRAM_ACCOUNT_METRICS,
  INSTAGRAM_DEMOGRAPHIC_BREAKDOWNS,
  INSTAGRAM_DEMOGRAPHICS_MIN_FOLLOWERS,
  INSTAGRAM_GRAPH,
  INSTAGRAM_GRAPH_VERSION,
  INSTAGRAM_LONG_LIVED_URL,
  INSTAGRAM_MEDIA_FIELDS,
  INSTAGRAM_MEDIA_INSIGHT_METRICS,
  INSTAGRAM_PROFILE_FIELDS,
  INSTAGRAM_REFRESH_URL,
  INSTAGRAM_SCOPES,
  INSTAGRAM_TOKEN_URL,
  buildInstagramAuthorizeUrl,
  type InstagramAccountType,
  type InstagramAdapter,
  type InstagramDemographicSlice,
  type InstagramDemographics,
  type InstagramMedia,
  type InstagramProfile,
  type InstagramToken,
} from "./adapter";

export type HttpClient = (url: string, init?: RequestInit) => Promise<Response>;

const TIMEFRAME_LABEL = /^(LAST_|THIS_|PREV_)/;

export function cleanInstagramCode(code: string): string {
  return code.replace(/#_$/, "").trim();
}

export function instagramError(body: unknown): { message: string; code: number | null } | null {
  if (!body || typeof body !== "object" || !("error" in body)) return null;
  const error = (body as { error?: unknown }).error;
  if (!error || typeof error !== "object") return null;
  const record = error as { message?: unknown; code?: unknown };
  return {
    message: typeof record.message === "string" ? record.message : "Error de Instagram",
    code: typeof record.code === "number" ? record.code : null,
  };
}

export function isInstagramRateLimited(status: number, body: unknown): boolean {
  if (status === 429) return true;
  const code = instagramError(body)?.code;
  return code === 4 || code === 17 || code === 32 || code === 613;
}

export function isInstagramPersonalAccount(body: unknown, accountType?: string | null): boolean {
  if (accountType?.toUpperCase() === "PERSONAL") return true;
  const message = instagramError(body)?.message.toLowerCase() ?? "";
  if (!message) return false;
  return (
    message.includes("personal") ||
    message.includes("not an instagram business") ||
    message.includes("not a business or creator") ||
    message.includes("professional account")
  );
}

export function isInstagramTokenExpired(status: number, body: unknown): boolean {
  if (status === 401) return true;
  const error = instagramError(body);
  if (error?.code === 190) return true;
  const message = error?.message.toLowerCase() ?? "";
  return message.includes("session has expired") || message.includes("error validating access token");
}

export function parseInstagramShortToken(body: unknown): { accessToken: string; userId: string | null; scopes: string[] } | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const nested = Array.isArray(record.data) ? record.data[0] : null;
  const source = nested && typeof nested === "object" ? (nested as Record<string, unknown>) : record;
  if (typeof source.access_token !== "string" || source.access_token.length === 0) return null;
  const scopes =
    typeof source.permissions === "string"
      ? source.permissions.split(",").map((item) => item.trim()).filter(Boolean)
      : [...INSTAGRAM_SCOPES];
  return {
    accessToken: source.access_token,
    userId: source.user_id == null ? null : String(source.user_id),
    scopes,
  };
}

export function parseLongLivedToken(body: unknown): { accessToken: string; expiresIn: number | null } | null {
  if (!body || typeof body !== "object") return null;
  const source = body as { access_token?: unknown; expires_in?: unknown };
  if (typeof source.access_token !== "string" || source.access_token.length === 0) return null;
  return {
    accessToken: source.access_token,
    expiresIn: typeof source.expires_in === "number" ? source.expires_in : null,
  };
}

export function parseInsightTotal(body: unknown, metric: string): number | null {
  if (!body || typeof body !== "object") return null;
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) return null;
  const found = data.find((item) => item && typeof item === "object" && (item as { name?: unknown }).name === metric);
  if (!found || typeof found !== "object") return null;
  const total = (found as { total_value?: { value?: unknown } }).total_value?.value;
  if (typeof total === "number" && Number.isFinite(total)) return total;
  return null;
}

export function parseDemographicRows(body: unknown): Array<{ label: string; value: number }> {
  if (!body || typeof body !== "object") return [];
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data) || !data[0] || typeof data[0] !== "object") return [];
  const breakdowns = (data[0] as { total_value?: { breakdowns?: unknown } }).total_value?.breakdowns;
  if (!Array.isArray(breakdowns)) return [];
  const rows: Array<{ label: string; value: number }> = [];
  for (const breakdown of breakdowns) {
    if (!breakdown || typeof breakdown !== "object") continue;
    const results = (breakdown as { results?: unknown }).results;
    if (!Array.isArray(results)) continue;
    for (const result of results) {
      if (!result || typeof result !== "object") continue;
      const dimensions = (result as { dimension_values?: unknown }).dimension_values;
      const value = (result as { value?: unknown }).value;
      if (!Array.isArray(dimensions) || typeof value !== "number") continue;
      const label = [...dimensions].reverse().find((item) => typeof item === "string" && !TIMEFRAME_LABEL.test(item));
      if (typeof label !== "string" || label.length === 0) continue;
      rows.push({ label, value });
    }
  }
  return rows;
}

export function toShareSlices(rows: Array<{ label: string; value: number }>): InstagramDemographicSlice[] {
  const total = rows.reduce((sum, row) => sum + (row.value > 0 ? row.value : 0), 0);
  if (total <= 0) return [];
  return rows
    .filter((row) => row.value > 0)
    .sort((left, right) => right.value - left.value)
    .slice(0, 45)
    .map((row) => ({ label: row.label, share: row.value / total }));
}

function accountTypeOf(value: unknown): InstagramAccountType {
  const upper = typeof value === "string" ? value.toUpperCase() : "";
  if (upper === "BUSINESS" || upper === "MEDIA_CREATOR" || upper === "PERSONAL") return upper;
  return "UNKNOWN";
}

function graphUrl(version: string, path: string, token: string, params: Record<string, string> = {}): string {
  const url = new URL(`${INSTAGRAM_GRAPH}/${version}/${path.replace(/^\//, "")}`);
  url.searchParams.set("access_token", token);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
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

export class LiveInstagramAdapter implements InstagramAdapter {
  private readonly fetchImpl: HttpClient;
  private readonly version: string;

  constructor(private readonly options: { appId?: string; appSecret?: string; graphVersion?: string; fetch?: HttpClient } = {}) {
    this.fetchImpl = options.fetch ?? fetch;
    this.version = options.graphVersion || process.env.INSTAGRAM_GRAPH_VERSION || INSTAGRAM_GRAPH_VERSION;
  }

  private appId(): string {
    const value = this.options.appId || process.env.INSTAGRAM_APP_ID;
    if (!value) throw new IntegrationNotConfigured("instagram", "Falta INSTAGRAM_APP_ID");
    return value;
  }

  private appSecret(): string {
    const value = this.options.appSecret || process.env.INSTAGRAM_APP_SECRET;
    if (!value) throw new IntegrationNotConfigured("instagram", "Falta INSTAGRAM_APP_SECRET");
    return value;
  }

  getAuthorizationUrl(input: { state: string; redirectUri: string }): string {
    return buildInstagramAuthorizeUrl({ clientId: this.appId(), redirectUri: input.redirectUri, state: input.state });
  }

  async exchangeCode(code: string, redirectUri: string): Promise<InstagramToken> {
    const form = new FormData();
    form.set("client_id", this.appId());
    form.set("client_secret", this.appSecret());
    form.set("grant_type", "authorization_code");
    form.set("redirect_uri", redirectUri);
    form.set("code", cleanInstagramCode(code));
    const response = await this.fetchImpl(INSTAGRAM_TOKEN_URL, { method: "POST", body: form, signal: AbortSignal.timeout(12_000) });
    const body = await readBody(response);
    if (isInstagramPersonalAccount(body)) {
      throw new SocialApiError("instagram", "personal_account", "La cuenta de Instagram no es profesional", 400);
    }
    this.assertOk("instagram", response.status, body);
    const shortLived = parseInstagramShortToken(body);
    if (!shortLived) throw new SocialApiError("instagram", "upstream", "Instagram no devolvió un access token", 502);
    const longLived = await this.exchangeLongLived(shortLived.accessToken);
    return {
      accessToken: longLived.accessToken,
      expiresAt: longLived.expiresIn ? new Date(Date.now() + longLived.expiresIn * 1000) : null,
      externalId: shortLived.userId,
      scopes: shortLived.scopes,
    };
  }

  async refreshAccessToken(accessToken: string): Promise<{ accessToken: string; expiresAt: Date | null }> {
    const url = new URL(INSTAGRAM_REFRESH_URL);
    url.searchParams.set("grant_type", "ig_refresh_token");
    url.searchParams.set("access_token", accessToken);
    const response = await this.fetchImpl(url.toString(), { signal: AbortSignal.timeout(12_000) });
    const body = await readBody(response);
    this.assertOk("instagram", response.status, body);
    const parsed = parseLongLivedToken(body);
    if (!parsed) throw new SocialApiError("instagram", "upstream", "Instagram no renovó el token", 502);
    return {
      accessToken: parsed.accessToken,
      expiresAt: parsed.expiresIn ? new Date(Date.now() + parsed.expiresIn * 1000) : null,
    };
  }

  async fetchProfile(accessToken: string): Promise<InstagramProfile> {
    const me = await this.getJson(graphUrl(this.version, "me", accessToken, { fields: INSTAGRAM_PROFILE_FIELDS }));
    const record = me && typeof me === "object" ? (me as Record<string, unknown>) : {};
    const accountType = accountTypeOf(record.account_type);
    if (accountType === "PERSONAL" || isInstagramPersonalAccount(me, accountType)) {
      throw new SocialApiError(
        "instagram",
        "personal_account",
        "Instagram solo conecta cuentas profesionales (creador o empresa)",
        400,
      );
    }
    const followers = numberOrNull(record.followers_count) ?? 0;
    const externalId = String(record.user_id ?? record.id ?? "");
    if (!externalId) throw new SocialApiError("instagram", "upstream", "Instagram no devolvió el id de la cuenta", 502);
    const since = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    const until = Math.floor(Date.now() / 1000);
    let reach30d: number | null = null;
    let views30d: number | null = null;
    let interactions30d: number | null = null;
    let rateLimited = false;
    try {
      const insights = await this.getJson(
        graphUrl(this.version, `${externalId}/insights`, accessToken, {
          metric: INSTAGRAM_ACCOUNT_METRICS.join(","),
          period: "day",
          metric_type: "total_value",
          since: String(since),
          until: String(until),
        }),
      );
      reach30d = parseInsightTotal(insights, "reach");
      views30d = parseInsightTotal(insights, "views");
      interactions30d = parseInsightTotal(insights, "total_interactions");
    } catch (error) {
      if (!isRate(error)) throw error;
      rateLimited = true;
    }

    let demographics: InstagramDemographics | null = null;
    let demographicsStatus: InstagramProfile["demographicsStatus"] = "unavailable";
    if (followers < INSTAGRAM_DEMOGRAPHICS_MIN_FOLLOWERS) {
      demographicsStatus = "under_100";
    } else if (!rateLimited) {
      try {
        demographics = await this.fetchDemographics(accessToken, externalId);
        demographicsStatus = demographics ? "available" : "unavailable";
      } catch (error) {
        if (!isRate(error)) throw error;
        rateLimited = true;
        demographicsStatus = "unavailable";
      }
    }

    return {
      externalId,
      handle: typeof record.username === "string" && record.username ? record.username.replace(/^@/, "") : externalId,
      accountType,
      avatarUrl: typeof record.profile_picture_url === "string" ? record.profile_picture_url : null,
      followers,
      following: numberOrNull(record.follows_count),
      mediaCount: numberOrNull(record.media_count),
      reach30d,
      views30d,
      interactions30d,
      demographics,
      demographicsStatus,
      rateLimited,
    };
  }

  async fetchRecentMedia(accessToken: string): Promise<InstagramMedia[]> {
    let body: unknown;
    try {
      body = await this.getJson(graphUrl(this.version, "me/media", accessToken, { fields: INSTAGRAM_MEDIA_FIELDS, limit: "8" }));
    } catch (error) {
      if (isRate(error)) return [];
      throw error;
    }
    const data = body && typeof body === "object" ? (body as { data?: unknown }).data : null;
    if (!Array.isArray(data)) return [];
    const media: InstagramMedia[] = [];
    for (const item of data) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      if (typeof record.id !== "string") continue;
      const metrics: Record<string, number> = {};
      if (typeof record.like_count === "number") metrics.likes = record.like_count;
      if (typeof record.comments_count === "number") metrics.comments = record.comments_count;
      try {
        const insights = await this.getJson(
          graphUrl(this.version, `${record.id}/insights`, accessToken, {
            metric: INSTAGRAM_MEDIA_INSIGHT_METRICS.join(","),
            period: "lifetime",
          }),
        );
        for (const metric of INSTAGRAM_MEDIA_INSIGHT_METRICS) {
          const value = parseInsightTotal(insights, metric);
          if (value !== null) metrics[metric] = value;
        }
      } catch (error) {
        if (!isRate(error) && !isInsightCompatibility(error)) throw error;
      }
      const thumbnail = typeof record.thumbnail_url === "string" ? record.thumbnail_url : typeof record.media_url === "string" ? record.media_url : null;
      media.push({
        externalId: record.id,
        url: typeof record.permalink === "string" ? record.permalink : null,
        type: typeof record.media_product_type === "string" ? record.media_product_type.toLowerCase() : typeof record.media_type === "string" ? record.media_type.toLowerCase() : "post",
        thumbnailUrl: thumbnail,
        publishedAt: typeof record.timestamp === "string" ? record.timestamp : null,
        metrics,
      });
    }
    return media;
  }

  private async exchangeLongLived(shortToken: string): Promise<{ accessToken: string; expiresIn: number | null }> {
    const url = new URL(INSTAGRAM_LONG_LIVED_URL);
    url.searchParams.set("grant_type", "ig_exchange_token");
    url.searchParams.set("client_secret", this.appSecret());
    url.searchParams.set("access_token", shortToken);
    const response = await this.fetchImpl(url.toString(), { signal: AbortSignal.timeout(12_000) });
    const body = await readBody(response);
    this.assertOk("instagram", response.status, body);
    const parsed = parseLongLivedToken(body);
    if (!parsed) throw new SocialApiError("instagram", "upstream", "Instagram no devolvió un token de larga duración", 502);
    return parsed;
  }

  private async fetchDemographics(accessToken: string, externalId: string): Promise<InstagramDemographics | null> {
    const groups = {
      countries: [] as InstagramDemographicSlice[],
      cities: [] as InstagramDemographicSlice[],
      ages: [] as InstagramDemographicSlice[],
      genders: [] as InstagramDemographicSlice[],
    };
    for (const breakdown of INSTAGRAM_DEMOGRAPHIC_BREAKDOWNS) {
      const body = await this.getJson(
        graphUrl(this.version, `${externalId}/insights`, accessToken, {
          metric: "follower_demographics",
          period: "lifetime",
          timeframe: "this_month",
          breakdown,
          metric_type: "total_value",
        }),
      );
      const slices = toShareSlices(parseDemographicRows(body));
      if (breakdown === "country") groups.countries = slices;
      if (breakdown === "city") groups.cities = slices;
      if (breakdown === "age") groups.ages = slices;
      if (breakdown === "gender") groups.genders = slices;
    }
    if (groups.countries.length + groups.cities.length + groups.ages.length + groups.genders.length === 0) return null;
    return groups;
  }

  private async getJson(url: string): Promise<unknown> {
    const response = await this.fetchImpl(url, { signal: AbortSignal.timeout(12_000) });
    const body = await readBody(response);
    if (isInstagramPersonalAccount(body)) {
      throw new SocialApiError("instagram", "personal_account", "Instagram solo conecta cuentas profesionales (creador o empresa)", 400);
    }
    this.assertOk("instagram", response.status, body);
    return body;
  }

  private assertOk(integration: "instagram", status: number, body: unknown): void {
    if (status >= 200 && status < 300 && !instagramError(body)) return;
    if (isInstagramRateLimited(status, body)) {
      throw new SocialApiError(integration, "rate_limited", "Instagram limitó las consultas", 429);
    }
    if (isInstagramTokenExpired(status, body)) {
      throw new SocialApiError(integration, "expired", "El acceso a Instagram venció", 401);
    }
    const message = instagramError(body)?.message ?? `Instagram respondió ${status}`;
    throw new SocialApiError(integration, "upstream", message, status || 502);
  }
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRate(error: unknown): boolean {
  return error instanceof SocialApiError && error.code === "rate_limited";
}

function isInsightCompatibility(error: unknown): boolean {
  return error instanceof SocialApiError && error.code === "upstream";
}
