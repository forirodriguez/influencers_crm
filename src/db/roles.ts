import postgres from "postgres";
import { quoteLiteral, rolePasswords } from "./hosted";

async function applyRole(sql: postgres.Sql, name: "app_user" | "app_jobs", password: string): Promise<void> {
  const literal = quoteLiteral(password);
  const existing = await sql<{ rolname: string }[]>`select rolname from pg_roles where rolname = ${name}`;
  if (existing.length === 0) {
    await sql.unsafe(`CREATE ROLE ${name} LOGIN PASSWORD ${literal}`);
  } else {
    await sql.unsafe(`ALTER ROLE ${name} WITH LOGIN PASSWORD ${literal}`);
  }
  await sql.unsafe(`ALTER ROLE ${name} SET search_path = public, app`);
}

export async function ensureRoles(databaseUrl: string): Promise<void> {
  const passwords = rolePasswords(databaseUrl);
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await applyRole(sql, "app_user", passwords.appUser);
    await applyRole(sql, "app_jobs", passwords.appJobs);
    const [database] = await sql<{ name: string }[]>`select current_database() as name`;
    const databaseName = database?.name ?? "";
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(databaseName)) {
      throw new Error("Nombre de base inesperado");
    }
    await sql.unsafe(`GRANT CONNECT ON DATABASE ${databaseName} TO app_user, app_jobs`);
    await sql.unsafe(`GRANT USAGE ON SCHEMA public TO app_user, app_jobs`);
    const appSchema = await sql<{ nspname: string }[]>`select nspname from pg_namespace where nspname = 'app'`;
    if (appSchema.length > 0) {
      await sql.unsafe(`GRANT USAGE ON SCHEMA app TO app_user, app_jobs`);
      await sql.unsafe(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO app_user, app_jobs`);
    }
  } finally {
    await sql.end();
  }
}
