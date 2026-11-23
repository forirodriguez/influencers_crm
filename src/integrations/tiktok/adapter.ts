export const TIKTOK_AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
export const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
export const TIKTOK_USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/";
export const TIKTOK_VIDEO_LIST_URL = "https://open.tiktokapis.com/v2/video/list/";
export const TIKTOK_SCOPES = ["user.info.basic", "user.info.stats", "video.list"] as const;
/** `username` pide `user.info.profile`, que no está en el alcance del MVP. */
export const TIKTOK_USER_FIELDS =
  "open_id,union_id,avatar_url,display_name,follower_count,following_count,likes_count,video_count";
export const TIKTOK_VIDEO_FIELDS =
  "id,title,cover_image_url,share_url,create_time,view_count,like_count,comment_count,share_count";
export const TIKTOK_VIDEO_PAGE_SIZE = 20;

export type TikTokProfile = {
  externalId: string;
  handle: string;
  avatarUrl: string | null;
  followers: number;
  following: number;
  likesTotal: number;
  videoCount: number;
};

export type TikTokVideo = {
  externalId: string;
  url: string | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
};

export type TikTokToken = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  externalId: string | null;
  scopes: string[];
};

export interface TikTokAdapter {
  getAuthorizationUrl(input: { state: string; redirectUri: string; codeChallenge: string }): string;
  exchangeCode(input: { code: string; codeVerifier: string; redirectUri: string }): Promise<TikTokToken>;
  refreshAccessToken(refreshToken: string): Promise<TikTokToken>;
  fetchProfile(accessToken: string): Promise<TikTokProfile>;
  fetchRecentVideos(accessToken: string): Promise<TikTokVideo[]>;
}

export function buildTikTokAuthorizeUrl(input: {
  clientKey: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(TIKTOK_AUTHORIZE_URL);
  url.searchParams.set("client_key", input.clientKey);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", TIKTOK_SCOPES.join(","));
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}
