const LOCAL_APP_USER_PASSWORD = "app_user_local";
const LOCAL_APP_JOBS_PASSWORD = "app_jobs_local";

export type RolePasswords = { appUser: string; appJobs: string };

export function isHostedDatabase(databaseUrl: string): boolean {
  try {
    const host = new URL(databaseUrl).hostname.toLowerCase();
    return host.endsWith(".supabase.co") || host.endsWith(".supabase.com") || host.includes("pooler.supabase");
  } catch {
    return false;
  }
}

export function isTransactionPooler(databaseUrl: string): boolean {
  try {
    return new URL(databaseUrl).port === "6543";
  } catch {
    return false;
  }
}

export function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function rolePasswords(databaseUrl: string): RolePasswords {
  const appUser = process.env.APP_USER_PASSWORD?.trim() ?? "";
  const appJobs = process.env.APP_JOBS_PASSWORD?.trim() ?? "";
  if (!isHostedDatabase(databaseUrl)) {
    return {
      appUser: appUser || LOCAL_APP_USER_PASSWORD,
      appJobs: appJobs || LOCAL_APP_JOBS_PASSWORD,
    };
  }
  const problems: string[] = [];
  if (appUser.length < 16 || appJobs.length < 16) {
    problems.push("APP_USER_PASSWORD y APP_JOBS_PASSWORD tienen que tener al menos 16 caracteres");
  }
  if (appUser === LOCAL_APP_USER_PASSWORD || appJobs === LOCAL_APP_JOBS_PASSWORD) {
    problems.push("no uses las contraseñas locales app_user_local ni app_jobs_local");
  }
  if (appUser && appUser === appJobs) {
    problems.push("las dos contraseñas tienen que ser distintas");
  }
  if (/[\r\n\0]/.test(appUser) || /[\r\n\0]/.test(appJobs)) {
    problems.push("las contraseñas no pueden tener saltos de línea");
  }
  if (problems.length > 0) {
    throw new Error(`Supabase rechazado: ${problems.join("; ")}.`);
  }
  return { appUser, appJobs };
}

export function assertMigrationConnection(databaseUrl: string): void {
  if (!isTransactionPooler(databaseUrl)) return;
  throw new Error(
    "Las migraciones no van por el pooler de transacción (puerto 6543). Usá la conexión directa db.<ref>.supabase.co:5432 o el session pooler (mismo host, puerto 5432).",
  );
}
