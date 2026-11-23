import { TIKTOK_SCOPES, buildTikTokAuthorizeUrl, type TikTokAdapter, type TikTokProfile, type TikTokToken, type TikTokVideo } from "./adapter";

const profile: TikTokProfile = {
  externalId: "mock-tt-user",
  handle: "mock.creator",
  avatarUrl: null,
  followers: 80200,
  following: 320,
  likesTotal: 1400000,
  videoCount: 86,
};

export class MockTikTokAdapter implements TikTokAdapter {
  getAuthorizationUrl(input: { state: string; redirectUri: string; codeChallenge: string }): string {
    return buildTikTokAuthorizeUrl({
      clientKey: process.env.TIKTOK_CLIENT_KEY || "mock-tiktok-key",
      redirectUri: input.redirectUri,
      state: input.state,
      codeChallenge: input.codeChallenge,
    });
  }

  async exchangeCode(): Promise<TikTokToken> {
    return {
      accessToken: "mock-tiktok-token",
      refreshToken: "mock-tiktok-refresh",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      externalId: profile.externalId,
      scopes: [...TIKTOK_SCOPES],
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<TikTokToken> {
    return {
      accessToken: "mock-tiktok-token",
      refreshToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      externalId: profile.externalId,
      scopes: [...TIKTOK_SCOPES],
    };
  }

  async fetchProfile(): Promise<TikTokProfile> {
    return profile;
  }

  async fetchRecentVideos(): Promise<TikTokVideo[]> {
    return [
      {
        externalId: "mock-video-1",
        url: "https://www.tiktok.com/@mock/video/1",
        thumbnailUrl: null,
        publishedAt: "2026-11-02T18:00:00.000Z",
        views: 54000,
        likes: 4100,
        comments: 120,
        shares: 80,
      },
    ];
  }
}

export { LiveTikTokAdapter } from "./live";
