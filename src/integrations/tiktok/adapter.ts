export const TIKTOK_AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
export const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
export const TIKTOK_SCOPES = ["user.info.basic", "user.info.stats", "video.list"] as const;

export type TikTokProfile = {
  externalId: string;
  handle: string;
  followers: number;
  following: number;
  likesTotal: number;
  videoCount: number;
};

export type TikTokVideo = {
  externalId: string;
  url: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
};

export interface TikTokAdapter {
  getAuthorizationUrl(input: { state: string; redirectUri: string; codeChallenge: string }): string;
  exchangeCode(input: { code: string; codeVerifier: string; redirectUri: string }): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: Date | null }>;
  fetchProfile(accessToken: string): Promise<TikTokProfile>;
  fetchRecentVideos(accessToken: string): Promise<TikTokVideo[]>;
}
