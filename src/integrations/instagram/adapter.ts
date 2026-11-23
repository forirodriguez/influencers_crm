export const INSTAGRAM_OAUTH_URL = "https://www.instagram.com/oauth/authorize";
export const INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
export const INSTAGRAM_GRAPH = "https://graph.instagram.com";
export const INSTAGRAM_LONG_LIVED_URL = "https://graph.instagram.com/access_token";
export const INSTAGRAM_REFRESH_URL = "https://graph.instagram.com/refresh_access_token";
/** v22 reemplazó `impressions` por `views`. Los nombres viven acá para poder subir de versión sin cazar strings. */
export const INSTAGRAM_GRAPH_VERSION = "v22.0";
export const INSTAGRAM_SCOPES = ["instagram_business_basic", "instagram_business_manage_insights"] as const;
export const INSTAGRAM_ACCOUNT_METRICS = ["reach", "views", "total_interactions"] as const;
export const INSTAGRAM_DEMOGRAPHIC_BREAKDOWNS = ["country", "city", "age", "gender"] as const;
export const INSTAGRAM_DEMOGRAPHICS_MIN_FOLLOWERS = 100;
export const INSTAGRAM_MEDIA_FIELDS =
  "id,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count";
export const INSTAGRAM_MEDIA_INSIGHT_METRICS = ["views", "reach", "saved", "shares"] as const;
export const INSTAGRAM_PROFILE_FIELDS =
  "user_id,username,account_type,profile_picture_url,followers_count,follows_count,media_count";

export type InstagramAccountType = "BUSINESS" | "MEDIA_CREATOR" | "PERSONAL" | "UNKNOWN";

export type InstagramDemographicSlice = { label: string; share: number };

export type InstagramDemographics = {
  countries: InstagramDemographicSlice[];
  cities: InstagramDemographicSlice[];
  ages: InstagramDemographicSlice[];
  genders: InstagramDemographicSlice[];
};

export type InstagramProfile = {
  externalId: string;
  handle: string;
  accountType: InstagramAccountType;
  avatarUrl: string | null;
  followers: number;
  following: number | null;
  mediaCount: number | null;
  reach30d: number | null;
  views30d: number | null;
  interactions30d: number | null;
  demographics: InstagramDemographics | null;
  demographicsStatus: "available" | "under_100" | "unavailable";
  rateLimited: boolean;
};

export type InstagramMedia = {
  externalId: string;
  url: string | null;
  type: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  metrics: Record<string, number>;
};

export type InstagramToken = {
  accessToken: string;
  expiresAt: Date | null;
  externalId: string | null;
  scopes: string[];
};

export interface InstagramAdapter {
  getAuthorizationUrl(input: { state: string; redirectUri: string }): string;
  exchangeCode(code: string, redirectUri: string): Promise<InstagramToken>;
  refreshAccessToken(accessToken: string): Promise<{ accessToken: string; expiresAt: Date | null }>;
  fetchProfile(accessToken: string): Promise<InstagramProfile>;
  fetchRecentMedia(accessToken: string): Promise<InstagramMedia[]>;
}

export function buildInstagramAuthorizeUrl(input: { clientId: string; redirectUri: string; state: string }): string {
  const url = new URL(INSTAGRAM_OAUTH_URL);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", INSTAGRAM_SCOPES.join(","));
  url.searchParams.set("state", input.state);
  return url.toString();
}
