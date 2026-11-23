import { NextResponse } from "next/server";
import { clearAuthCookies } from "../../../../../server/cookies";

export async function POST() {
  const response = NextResponse.json({ data: { ok: true } });
  clearAuthCookies(response);
  return response;
}
