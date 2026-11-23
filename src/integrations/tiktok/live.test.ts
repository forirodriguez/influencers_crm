import { describe, expect, it } from "vitest";
import { TIKTOK_SCOPES, TIKTOK_USER_FIELDS } from "./adapter";
import { LiveTikTokAdapter, handleFromDisplayName, isTikTokRateLimited, parseTikTokToken, parseTikTokUser, parseTikTokVideos } from "./live";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("tiktok live", () => {
  it("parsea token, perfil y videos sin pedir username", () => {
    expect(TIKTOK_USER_FIELDS.includes("username")).toBe(false);
    expect(TIKTOK_SCOPES).toEqual(["user.info.basic", "user.info.stats", "video.list"]);
    expect(
      parseTikTokToken({
        access_token: "act.1",
        refresh_token: "rft.1",
        expires_in: 86400,
        open_id: "oid",
        scope: "user.info.basic,user.info.stats,video.list",
      })?.accessToken,
    ).toBe("act.1");
    expect(parseTikTokToken({ error: "invalid_grant", error_description: "no" })).toBeNull();
    expect(
      parseTikTokUser({
        data: { user: { open_id: "oid", display_name: "Diego Ruiz", follower_count: 80, following_count: 2, likes_count: 10, video_count: 3 } },
        error: { code: "ok", message: "" },
      }),
    ).toMatchObject({ handle: "diegoruiz", followers: 80 });
    expect(handleFromDisplayName("   ", "fallback")).toBe("fallback");
    expect(
      parseTikTokVideos({
        data: { videos: [{ id: "v1", share_url: "https://www.tiktok.com/@a/video/1", create_time: 1700000000, view_count: 5, like_count: 1, comment_count: 0, share_count: 0 }] },
        error: { code: "ok" },
      }),
    ).toHaveLength(1);
    expect(isTikTokRateLimited(429, { error: { code: "rate_limit_exceeded" } })).toBe(true);
  });

  it("el login usa PKCE y un 429 de video.list no tira el perfil", async () => {
    const adapter = new LiveTikTokAdapter({
      clientKey: "key",
      clientSecret: "secret",
      fetch: async (url, init) => {
        const href = String(url);
        if (href.includes("/oauth/token/") && init?.method === "POST") {
          return jsonResponse({ access_token: "act", refresh_token: "rft", expires_in: 3600, open_id: "oid", scope: "user.info.stats" });
        }
        if (href.includes("/v2/video/list/")) {
          return jsonResponse({ error: { code: "rate_limit_exceeded", message: "too many" } }, 429);
        }
        return jsonResponse({
          data: { user: { open_id: "oid", display_name: "Nati", follower_count: 10, following_count: 1, likes_count: 2, video_count: 1 } },
          error: { code: "ok", message: "" },
        });
      },
    });
    const url = adapter.getAuthorizationUrl({ state: "s", redirectUri: "https://app.example/cb", codeChallenge: "abc" });
    expect(url).toContain("code_challenge_method=S256");
    expect(url).toContain("user.info.stats");
    const token = await adapter.exchangeCode({ code: "c", codeVerifier: "v", redirectUri: "https://app.example/cb" });
    expect(token.refreshToken).toBe("rft");
    await expect(adapter.fetchRecentVideos(token.accessToken)).resolves.toEqual([]);
  });
});
