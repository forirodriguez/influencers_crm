import { NextResponse } from "next/server";
import { SESSION_MAX_AGE_SECONDS } from "../lib/constants";

const base = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_MAX_AGE_SECONDS,
};

export function setAuthCookies(
  response: NextResponse,
  input: { token: string; workspaceId: string; locale: string },
): void {
  response.cookies.set("icrm_session", input.token, base);
  response.cookies.set("icrm_workspace", input.workspaceId, base);
  response.cookies.set("icrm_locale", input.locale, { ...base, httpOnly: false });
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set("icrm_session", "", { ...base, maxAge: 0 });
  response.cookies.set("icrm_workspace", "", { ...base, maxAge: 0 });
  response.cookies.set("icrm_locale", "", { ...base, httpOnly: false, maxAge: 0 });
}
