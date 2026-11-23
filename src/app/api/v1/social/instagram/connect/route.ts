import { NextResponse } from "next/server";
import { getEnv } from "../../../../../../lib/env.server";
import { ApiError } from "../../../../../../lib/errors";
import { getInstagramAdapter } from "../../../../../../integrations";
import { connectInstagram } from "../../../../../../modules/media-kit/sync";
import { OAUTH_COOKIE, OAUTH_MAX_AGE_SECONDS, issueOAuthState } from "../../../../../../modules/media-kit/oauth-state";
import { jsonError } from "../../../../../../server/http";
import { requireEditor } from "../../guard";

export async function GET(req: Request) {
  try {
    const editor = await requireEditor(req);
    const profileId = new URL(req.url).searchParams.get("profileId");
    if (!profileId) throw new ApiError("profile_required", "Falta el perfil", 400);
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI || `${getEnv().NEXT_PUBLIC_APP_URL}/api/v1/social/instagram/callback`;
    if (process.env.INTEGRATIONS_MODE !== "live") {
      await connectInstagram({
        userId: editor.userId,
        workspaceId: editor.workspaceId,
        profileId,
        code: "mock",
        redirectUri,
      });
      return NextResponse.redirect(editorUrl(profileId, { connected: "instagram" }));
    }
    if (!process.env.INSTAGRAM_APP_ID || !process.env.INSTAGRAM_APP_SECRET) {
      return NextResponse.redirect(editorUrl(profileId, { error: "missing_instagram_keys" }));
    }
    const issued = issueOAuthState({
      provider: "instagram",
      profileId,
      userId: editor.userId,
      workspaceId: editor.workspaceId,
      codeVerifier: null,
    });
    const response = NextResponse.redirect(getInstagramAdapter().getAuthorizationUrl({ state: issued.nonce, redirectUri }));
    response.cookies.set(OAUTH_COOKIE, issued.cookie, oauthCookie());
    return response;
  } catch (error) {
    if (error instanceof ApiError && error.code === "instagram_personal") {
      return NextResponse.redirect(editorUrl("", { error: "instagram_personal" }));
    }
    return jsonError(error);
  }
}

function editorUrl(profileId: string, params: Record<string, string>): URL {
  const url = new URL("/media-kit", getEnv().NEXT_PUBLIC_APP_URL);
  if (profileId) url.searchParams.set("profile", profileId);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

function oauthCookie() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/api/v1/social",
    secure: process.env.NODE_ENV === "production",
    maxAge: OAUTH_MAX_AGE_SECONDS,
  };
}
