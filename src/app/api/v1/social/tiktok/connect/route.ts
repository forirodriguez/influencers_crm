import { NextResponse } from "next/server";
import { getTikTokAdapter } from "../../../../../../integrations";
import { getEnv } from "../../../../../../lib/env.server";
import { ApiError } from "../../../../../../lib/errors";
import { OAUTH_COOKIE, OAUTH_MAX_AGE_SECONDS, createPkce, issueOAuthState } from "../../../../../../modules/media-kit/oauth-state";
import { connectTikTok } from "../../../../../../modules/media-kit/sync";
import { jsonError } from "../../../../../../server/http";
import { requireEditor } from "../../guard";

export async function GET(req: Request) {
  try {
    const editor = await requireEditor(req);
    const profileId = new URL(req.url).searchParams.get("profileId");
    if (!profileId) throw new ApiError("profile_required", "Falta el perfil", 400);
    const redirectUri = process.env.TIKTOK_REDIRECT_URI || `${getEnv().NEXT_PUBLIC_APP_URL}/api/v1/social/tiktok/callback`;
    if (process.env.INTEGRATIONS_MODE !== "live") {
      await connectTikTok({
        userId: editor.userId,
        workspaceId: editor.workspaceId,
        profileId,
        code: "mock",
        codeVerifier: "mock",
        redirectUri,
      });
      return NextResponse.redirect(editorUrl(profileId, { connected: "tiktok" }));
    }
    if (!process.env.TIKTOK_CLIENT_KEY || !process.env.TIKTOK_CLIENT_SECRET) {
      return NextResponse.redirect(editorUrl(profileId, { error: "missing_tiktok_keys" }));
    }
    const pkce = createPkce();
    const issued = issueOAuthState({
      provider: "tiktok",
      profileId,
      userId: editor.userId,
      workspaceId: editor.workspaceId,
      codeVerifier: pkce.verifier,
    });
    const response = NextResponse.redirect(
      getTikTokAdapter().getAuthorizationUrl({ state: issued.nonce, redirectUri, codeChallenge: pkce.challenge }),
    );
    response.cookies.set(OAUTH_COOKIE, issued.cookie, {
      httpOnly: true,
      sameSite: "lax",
      path: "/api/v1/social",
      secure: process.env.NODE_ENV === "production",
      maxAge: OAUTH_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error) {
    return jsonError(error);
  }
}

function editorUrl(profileId: string, params: Record<string, string>): URL {
  const url = new URL("/media-kit", getEnv().NEXT_PUBLIC_APP_URL);
  if (profileId) url.searchParams.set("profile", profileId);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}
