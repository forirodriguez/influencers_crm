import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { ensureRoles } from "../src/db/roles";
import { maintenanceUrl, testDatabaseUrl } from "./db-url";

export default async function setup(): Promise<void> {
  const admin = postgres(maintenanceUrl(), { max: 1 });
  const existing = await admin`select 1 from pg_database where datname = 'influencers_crm_test'`;
  if (existing.length === 0) {
    await admin.unsafe("CREATE DATABASE influencers_crm_test");
  }
  await admin.end();
  await ensureRoles(testDatabaseUrl);
  const connection = postgres(testDatabaseUrl, { max: 1, onnotice: () => {} });
  await migrate(drizzle(connection), { migrationsFolder: "drizzle" });
  await connection.end();
}
