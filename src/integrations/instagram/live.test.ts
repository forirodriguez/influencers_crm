import { describe, expect, it } from "vitest";
import { INSTAGRAM_DEMOGRAPHICS_MIN_FOLLOWERS } from "./adapter";
import { LiveInstagramAdapter, isInstagramPersonalAccount, parseDemographicRows, parseInsightTotal, toShareSlices } from "./live";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("instagram live", () => {
  it("no pide demografía si hay menos de 100 seguidores", async () => {
    const calls: string[] = [];
    const adapter = new LiveInstagramAdapter({
      appId: "app",
      appSecret: "secret",
      fetch: async (url) => {
        const href = String(url);
        calls.push(href);
        if (href.includes("/me?")) {
          return jsonResponse({
            user_id: "1784",
            username: "nano",
            account_type: "MEDIA_CREATOR",
            followers_count: 40,
            follows_count: 3,
            media_count: 2,
          });
        }
        if (href.includes("/insights")) {
          return jsonResponse({
            data: [
              { name: "reach", total_value: { value: 10 } },
              { name: "views", total_value: { value: 20 } },
              { name: "total_interactions", total_value: { value: 1 } },
            ],
          });
        }
        if (href.includes("/media")) return jsonResponse({ data: [] });
        return jsonResponse({});
      },
    });
    const profile = await adapter.fetchProfile("token");
    expect(profile.followers).toBe(40);
    expect(profile.demographics).toBeNull();
    expect(profile.demographicsStatus).toBe("under_100");
    expect(profile.reach30d).toBe(10);
    expect(calls.some((url) => url.includes("follower_demographics"))).toBe(false);
    expect(INSTAGRAM_DEMOGRAPHICS_MIN_FOLLOWERS).toBe(100);
  });

  it("arma shares de demografía y rechaza una cuenta personal", async () => {
    const rows = parseDemographicRows({
      data: [
        {
          name: "follower_demographics",
          total_value: {
            breakdowns: [
              {
                results: [
                  { dimension_values: ["THIS_MONTH", "AR"], value: 70 },
                  { dimension_values: ["THIS_MONTH", "MX"], value: 30 },
                ],
              },
            ],
          },
        },
      ],
    });
    expect(toShareSlices(rows)).toEqual([
      { label: "AR", share: 0.7 },
      { label: "MX", share: 0.3 },
    ]);
    expect(parseInsightTotal({ data: [{ name: "views", total_value: { value: 12 } }] }, "views")).toBe(12);
    expect(isInstagramPersonalAccount({ error: { message: "The user is not an Instagram Business", code: 10 } })).toBe(true);

    const adapter = new LiveInstagramAdapter({
      appId: "app",
      appSecret: "secret",
      fetch: async () => jsonResponse({ user_id: "1", username: "personal", account_type: "PERSONAL", followers_count: 10 }),
    });
    await expect(adapter.fetchProfile("token")).rejects.toMatchObject({ code: "personal_account" });
  });

  it("cambia el code por un token largo y marca el límite de la API", async () => {
    const adapter = new LiveInstagramAdapter({
      appId: "app",
      appSecret: "secret",
      fetch: async (url, init) => {
        const href = String(url);
        if (href.includes("api.instagram.com/oauth/access_token") && init?.method === "POST") {
          return jsonResponse({ data: [{ access_token: "short", user_id: "99", permissions: "instagram_business_basic" }] });
        }
        if (href.includes("grant_type=ig_exchange_token")) {
          return jsonResponse({ access_token: "long-lived", token_type: "bearer", expires_in: 5184000 });
        }
        if (href.includes("/me?")) {
          return jsonResponse({ user_id: "99", username: "cami", account_type: "MEDIA_CREATOR", followers_count: 200, media_count: 3 });
        }
        if (href.includes("/insights")) {
          return jsonResponse({ error: { message: "Application request limit reached", code: 4 } }, 400);
        }
        return jsonResponse({ data: [] });
      },
    });
    const token = await adapter.exchangeCode("code#_", "https://app.example/callback");
    expect(token.accessToken).toBe("long-lived");
    expect(token.externalId).toBe("99");
    expect(token.expiresAt).not.toBeNull();
    const profile = await adapter.fetchProfile("long-lived");
    expect(profile.rateLimited).toBe(true);
    expect(profile.reach30d).toBeNull();
    expect(profile.demographicsStatus).toBe("unavailable");
  });
});
