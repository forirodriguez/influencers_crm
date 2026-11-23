import { NextResponse } from "next/server";
import { getEnv } from "../../../../../../lib/env.server";
import { consumeMagicLink } from "../../../../../../modules/identity/service";
import { setAuthCookies } from "../../../../../../server/cookies";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  try {
    const result = await consumeMagicLink(token);
    const destination = result.needsOnboarding ? "/onboarding" : "/hoy";
    const response = NextResponse.redirect(new URL(destination, getEnv().NEXT_PUBLIC_APP_URL));
    setAuthCookies(response, result);
    return response;
  } catch {
    return NextResponse.redirect(new URL("/login?error=link", getEnv().NEXT_PUBLIC_APP_URL));
  }
}
