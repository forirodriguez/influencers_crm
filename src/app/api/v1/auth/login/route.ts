import { loginWithPassword } from "../../../../../modules/identity/service";
import { setAuthCookies } from "../../../../../server/cookies";
import { clientIp, jsonData, jsonError } from "../../../../../server/http";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const result = await loginWithPassword({ email: body.email ?? "", password: body.password ?? "", ip: clientIp(req) });
    const response = jsonData({ userId: result.userId, workspaceId: result.workspaceId, needsOnboarding: result.needsOnboarding });
    setAuthCookies(response, result);
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
