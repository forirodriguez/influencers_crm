import { NextResponse } from "next/server";
import { getEnv } from "../../../../../../lib/env.server";
import { ApiError } from "../../../../../../lib/errors";
import { readCookie } from "../../../../../../lib/session";
import { OAUTH_COOKIE, readOAuthState } from "../../../../../../modules/media-kit/oauth-state";
import { connectTikTok } from "../../../../../../modules/media-kit/sync";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const oauth = readOAuthState(readCookie(req.headers.get("cookie"), OAUTH_COOKIE));
  const profileId = oauth?.profileId ?? "";
  if (!oauth || oauth.provider !== "tiktok" || oauth.nonce !== url.searchParams.get("state") || !oauth.codeVerifier) {
    return finish(profileId, { error: "oauth_state" });
  }
  if (url.searchParams.get("error") || !url.searchParams.get("code")) {
    return finish(profileId, { error: "oauth_denied" });
  }
  try {
    const redirectUri = process.env.TIKTOK_REDIRECT_URI || `${getEnv().NEXT_PUBLIC_APP_URL}/api/v1/social/tiktok/callback`;
    await connectTikTok({
      userId: oauth.userId,
      workspaceId: oauth.workspaceId,
      profileId: oauth.profileId,
      code: url.searchParams.get("code") ?? "",
      codeVerifier: oauth.codeVerifier,
      redirectUri,
    });
    return finish(profileId, { connected: "tiktok" });
  } catch (error) {
    const code = error instanceof ApiError ? error.code : "oauth_failed";
    return finish(profileId, { error: code });
  }
}

function finish(profileId: string, params: Record<string, string>) {
  const url = new URL("/media-kit", getEnv().NEXT_PUBLIC_APP_URL);
  if (profileId) url.searchParams.set("profile", profileId);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = NextResponse.redirect(url);
  response.cookies.set(OAUTH_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/api/v1/social", maxAge: 0 });
  return response;
}
