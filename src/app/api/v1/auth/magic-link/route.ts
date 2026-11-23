import { requestMagicLink } from "../../../../../modules/identity/service";
import { clientIp, jsonData, jsonError } from "../../../../../server/http";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string };
    const result = await requestMagicLink(body.email ?? "", clientIp(req));
    return jsonData(result);
  } catch (error) {
    return jsonError(error);
  }
}
