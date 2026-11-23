export const INSTAGRAM_OAUTH_URL = "https://www.instagram.com/oauth/authorize";
export const INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
export const INSTAGRAM_GRAPH = "https://graph.instagram.com";
export const INSTAGRAM_SCOPES = ["instagram_business_basic", "instagram_business_manage_insights"] as const;

export type InstagramProfile = {
  externalId: string;
  handle: string;
  followers: number;
  mediaCount: number;
  reach30d: number | null;
  views30d: number | null;
  interactions30d: number | null;
  demographics: Record<string, unknown> | null;
};

export type InstagramMedia = {
  externalId: string;
  url: string | null;
  type: string;
  metrics: Record<string, number>;
};

export interface InstagramAdapter {
  getAuthorizationUrl(input: { state: string; redirectUri: string }): string;
  exchangeCode(code: string): Promise<{ accessToken: string; expiresAt: Date | null }>;
  fetchProfile(accessToken: string): Promise<InstagramProfile>;
  fetchRecentMedia(accessToken: string): Promise<InstagramMedia[]>;
}
