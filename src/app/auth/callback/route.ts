import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { withAdmin } from "../../../db/client";
import { getEnv } from "../../../lib/env.server";
import { createSessionToken } from "../../../lib/session";
import { createWorkspaceWithOwner } from "../../../modules/identity/bootstrap";
import { memberships, users } from "../../../modules/identity/schema";
import { slugify } from "../../../lib/slug";
import { setAuthCookies } from "../../../server/cookies";

export async function GET(req: Request) {
  const env = getEnv();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (env.AUTH_MODE !== "supabase" || !env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !code) {
    return NextResponse.redirect(new URL("/login?error=google", env.NEXT_PUBLIC_APP_URL));
  }
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const exchanged = await supabase.auth.exchangeCodeForSession(code);
  const supaUser = exchanged.data.user;
  if (exchanged.error || !supaUser?.email) {
    return NextResponse.redirect(new URL("/login?error=google", env.NEXT_PUBLIC_APP_URL));
  }
  const local = await withAdmin(async (db) => {
    const [existing] = await db.select().from(users).where(eq(users.id, supaUser.id)).limit(1);
    if (existing) return existing;
    const [created] = await db
      .insert(users)
      .values({
        id: supaUser.id,
        email: supaUser.email!,
        name: supaUser.user_metadata?.full_name ?? supaUser.email!.split("@")[0],
        avatarUrl: supaUser.user_metadata?.avatar_url ?? null,
      })
      .returning();
    if (!created) throw new Error("No se pudo crear el usuario de Google");
    await createWorkspaceWithOwner(db, {
      ownerId: created.id,
      name: created.name ?? "Mi espacio",
      type: "personal",
      country: null,
      currency: "ARS",
      profile: {
        displayName: created.name ?? "Creator",
        slug: slugify(created.name ?? created.email),
        country: null,
        publicEmail: created.email,
      },
    });
    return created;
  });
  const [membership] = await withAdmin(async (db) =>
    db.select({ workspaceId: memberships.workspaceId }).from(memberships).where(eq(memberships.userId, local.id)).limit(1),
  );
  const response = NextResponse.redirect(new URL(local.country ? "/hoy" : "/onboarding", env.NEXT_PUBLIC_APP_URL));
  setAuthCookies(response, {
    token: await createSessionToken(local.id),
    workspaceId: membership?.workspaceId ?? "",
    locale: local.locale,
  });
  return response;
}
