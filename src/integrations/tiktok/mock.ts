import { IntegrationNotConfigured } from "../../lib/errors";
import { TIKTOK_AUTHORIZE_URL, TIKTOK_SCOPES, type TikTokAdapter, type TikTokProfile, type TikTokVideo } from "./adapter";

const profile: TikTokProfile = {
  externalId: "mock-tt-user",
  handle: "mock.creator",
  followers: 80200,
  following: 320,
  likesTotal: 1400000,
  videoCount: 86,
};

export class MockTikTokAdapter implements TikTokAdapter {
  getAuthorizationUrl(input: { state: string; redirectUri: string; codeChallenge: string }): string {
    const url = new URL(TIKTOK_AUTHORIZE_URL);
    url.searchParams.set("client_key", process.env.TIKTOK_CLIENT_KEY || "mock-tiktok-key");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", TIKTOK_SCOPES.join(","));
    url.searchParams.set("redirect_uri", input.redirectUri);
    url.searchParams.set("state", input.state);
    url.searchParams.set("code_challenge", input.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }

  async exchangeCode(): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: Date | null }> {
    return { accessToken: "mock-tiktok-token", refreshToken: "mock-tiktok-refresh", expiresAt: null };
  }

  async fetchProfile(): Promise<TikTokProfile> {
    return profile;
  }

  async fetchRecentVideos(): Promise<TikTokVideo[]> {
    return [{ externalId: "mock-video-1", url: "https://www.tiktok.com/@mock/video/1", views: 54000, likes: 4100, comments: 120, shares: 80 }];
  }
}

export class LiveTikTokAdapter extends MockTikTokAdapter {
  async exchangeCode(): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: Date | null }> {
    throw new IntegrationNotConfigured("tiktok", "El canje PKCE de TikTok lo implementa el módulo de media kit.");
  }

  async fetchProfile(): Promise<TikTokProfile> {
    throw new IntegrationNotConfigured("tiktok");
  }

  async fetchRecentVideos(): Promise<TikTokVideo[]> {
    throw new IntegrationNotConfigured("tiktok");
  }
}
