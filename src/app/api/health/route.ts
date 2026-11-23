import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAdminDb } from "../../../db/client";

export async function GET() {
  try {
    await getAdminDb().execute(sql`select 1`);
    return NextResponse.json({ data: { ok: true, service: "influencers_crm" } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: { code: "unavailable", message: "La base no responde" } }, { status: 503 });
  }
}
