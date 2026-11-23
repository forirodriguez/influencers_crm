import postgres from "postgres";

const APP_USER_PASSWORD = "app_user_local";
const APP_JOBS_PASSWORD = "app_jobs_local";

export async function ensureRoles(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const existing = await sql<{ rolname: string }[]>`
      select rolname from pg_roles where rolname in ('app_user', 'app_jobs')
    `;
    const names = new Set(existing.map((row) => row.rolname));
    if (!names.has("app_user")) {
      await sql.unsafe(`CREATE ROLE app_user LOGIN PASSWORD '${APP_USER_PASSWORD}'`);
    }
    if (!names.has("app_jobs")) {
      await sql.unsafe(`CREATE ROLE app_jobs LOGIN PASSWORD '${APP_JOBS_PASSWORD}'`);
    }
  } finally {
    await sql.end();
  }
}
