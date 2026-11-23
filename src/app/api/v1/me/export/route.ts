import { exportAccount, exportCsv } from "../../../../../modules/identity/privacy";
import { jsonData, jsonError, readSession } from "../../../../../server/http";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const session = await readSession(req);
    if (!session) return NextResponse.json({ error: { code: "unauthorized", message: "Tenés que iniciar sesión" } }, { status: 401 });
    const body = (await req.json().catch(() => ({}))) as { format?: string };
    const data = await exportAccount(session.sub);
    if (body.format === "csv") {
      return new NextResponse(exportCsv(data), {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="cobros.csv"',
        },
      });
    }
    return jsonData({ export: data });
  } catch (error) {
    return jsonError(error);
  }
}
