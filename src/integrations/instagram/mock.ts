import {
  INSTAGRAM_SCOPES,
  buildInstagramAuthorizeUrl,
  type InstagramAdapter,
  type InstagramMedia,
  type InstagramProfile,
  type InstagramToken,
} from "./adapter";

const profile: InstagramProfile = {
  externalId: "mock-ig-user",
  handle: "mock.creator",
  accountType: "MEDIA_CREATOR",
  avatarUrl: null,
  followers: 35200,
  following: 890,
  mediaCount: 128,
  reach30d: 84000,
  views30d: 120000,
  interactions30d: 6400,
  demographics: {
    countries: [{ label: "AR", share: 0.62 }, { label: "UY", share: 0.14 }],
    cities: [{ label: "Buenos Aires", share: 0.41 }],
    ages: [{ label: "25-34", share: 0.48 }],
    genders: [{ label: "F", share: 0.7 }, { label: "M", share: 0.3 }],
  },
  demographicsStatus: "available",
  rateLimited: false,
};

export class MockInstagramAdapter implements InstagramAdapter {
  getAuthorizationUrl(input: { state: string; redirectUri: string }): string {
    return buildInstagramAuthorizeUrl({
      clientId: process.env.INSTAGRAM_APP_ID || "mock-instagram-app",
      redirectUri: input.redirectUri,
      state: input.state,
    });
  }

  async exchangeCode(): Promise<InstagramToken> {
    return {
      accessToken: "mock-instagram-token",
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      externalId: profile.externalId,
      scopes: [...INSTAGRAM_SCOPES],
    };
  }

  async refreshAccessToken(accessToken: string): Promise<{ accessToken: string; expiresAt: Date | null }> {
    return { accessToken, expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) };
  }

  async fetchProfile(): Promise<InstagramProfile> {
    return profile;
  }

  async fetchRecentMedia(): Promise<InstagramMedia[]> {
    return [
      {
        externalId: "mock-media-1",
        url: "https://instagram.com/p/mock",
        type: "reel",
        thumbnailUrl: null,
        publishedAt: "2026-11-01T15:00:00.000Z",
        metrics: { views: 12000, likes: 900 },
      },
    ];
  }
}

export { LiveInstagramAdapter } from "./live";
