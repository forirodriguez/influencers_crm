import { NextResponse } from "next/server";
import { rateLimit } from "../../../../../../lib/rate-limit";
import { getPublicMediaKit } from "../../../../../../modules/media-kit/queries";
import { clientIp, jsonData } from "../../../../../../server/http";

type Params = { params: Promise<{ slug: string }> };

export async function GET(req: Request, { params }: Params) {
  const { slug } = await params;
  if (!rateLimit(`media-kit:${clientIp(req)}`, 60, 60_000)) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Demasiadas consultas. Probá de nuevo en un minuto" } },
      { status: 429 },
    );
  }
  const kit = await getPublicMediaKit(slug);
  if (!kit) {
    return NextResponse.json({ error: { code: "not_found", message: "Este media kit no existe" } }, { status: 404 });
  }
  const response = jsonData(kit);
  response.headers.set("cache-control", "public, max-age=60");
  return response;
}
