import { NextResponse } from "next/server";
import { registerWithPassword, type CountryChoice } from "../../../../../modules/identity/service";
import { setAuthCookies } from "../../../../../server/cookies";
import { clientIp, jsonData, jsonError } from "../../../../../server/http";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      name?: string;
      email?: string;
      password?: string;
      country?: CountryChoice;
      timezone?: string;
      acceptTerms?: boolean;
    };
    const result = await registerWithPassword({
      name: body.name ?? "",
      email: body.email ?? "",
      password: body.password ?? "",
      country: body.country as CountryChoice,
      timezone: body.timezone,
      acceptTerms: body.acceptTerms === true,
      ip: clientIp(req),
    });
    const response = jsonData({ userId: result.userId, workspaceId: result.workspaceId, needsOnboarding: result.needsOnboarding });
    setAuthCookies(response, result);
    return response;
  } catch (error) {
    return jsonError(error);
  }
}

export function GET() {
  return NextResponse.json({ error: { code: "method_not_allowed", message: "Usá POST" } }, { status: 405 });
}
