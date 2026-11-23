import { IntegrationNotConfigured } from "../../lib/errors";
import { INSTAGRAM_OAUTH_URL, INSTAGRAM_SCOPES, type InstagramAdapter, type InstagramMedia, type InstagramProfile } from "./adapter";

const profile: InstagramProfile = {
  externalId: "mock-ig-user",
  handle: "mock.creator",
  followers: 35200,
  mediaCount: 128,
  reach30d: 84000,
  views30d: 120000,
  interactions30d: 6400,
  demographics: { countries: [{ code: "AR", share: 0.6 }] },
};

export class MockInstagramAdapter implements InstagramAdapter {
  getAuthorizationUrl(input: { state: string; redirectUri: string }): string {
    const url = new URL(INSTAGRAM_OAUTH_URL);
    url.searchParams.set("client_id", process.env.INSTAGRAM_APP_ID || "mock-instagram-app");
    url.searchParams.set("redirect_uri", input.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", INSTAGRAM_SCOPES.join(","));
    url.searchParams.set("state", input.state);
    return url.toString();
  }

  async exchangeCode(): Promise<{ accessToken: string; expiresAt: Date | null }> {
    return { accessToken: "mock-instagram-token", expiresAt: null };
  }

  async fetchProfile(): Promise<InstagramProfile> {
    return profile;
  }

  async fetchRecentMedia(): Promise<InstagramMedia[]> {
    return [{ externalId: "mock-media-1", url: "https://instagram.com/p/mock", type: "reel", metrics: { views: 12000, likes: 900 } }];
  }
}

export class LiveInstagramAdapter extends MockInstagramAdapter {
  async exchangeCode(): Promise<{ accessToken: string; expiresAt: Date | null }> {
    throw new IntegrationNotConfigured("instagram", "El canje de code lo implementa el módulo de media kit contra Instagram API with Instagram Login.");
  }

  async fetchProfile(): Promise<InstagramProfile> {
    throw new IntegrationNotConfigured("instagram");
  }

  async fetchRecentMedia(): Promise<InstagramMedia[]> {
    throw new IntegrationNotConfigured("instagram");
  }
}
