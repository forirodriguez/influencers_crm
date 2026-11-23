import { loadEnvFile } from "../src/db/load-env";

loadEnvFile();

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

const admin = process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/influencers_crm";
const app = process.env.DATABASE_URL_APP ?? "postgres://app_user:app_user_local@127.0.0.1:5432/influencers_crm";
const jobs = process.env.DATABASE_URL_JOBS ?? "postgres://app_jobs:app_jobs_local@127.0.0.1:5432/influencers_crm";

export const testDatabaseUrl = withDatabase(admin, "influencers_crm_test");
export const testAppUrl = withDatabase(app, "influencers_crm_test");
export const testJobsUrl = withDatabase(jobs, "influencers_crm_test");

export function maintenanceUrl(url = admin): string {
  return withDatabase(url, "postgres");
}
