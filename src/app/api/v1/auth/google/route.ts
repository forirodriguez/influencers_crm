import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getEnv } from "../../../../../lib/env.server";

export async function GET() {
  const env = getEnv();
  const login = new URL("/login?error=google", env.NEXT_PUBLIC_APP_URL);
  if (env.AUTH_MODE !== "supabase" || !env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.redirect(login);
  }
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback` },
  });
  if (error || !data.url) return NextResponse.redirect(login);
  return NextResponse.redirect(data.url);
}
