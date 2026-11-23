import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { connectionOptions } from "./connection";
import { assertMigrationConnection } from "./hosted";
import { loadEnvFile } from "./load-env";
import { ensureRoles } from "./roles";

loadEnvFile();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL es obligatorio para migrar");
}

assertMigrationConnection(databaseUrl);
await ensureRoles(databaseUrl);
const connection = postgres(databaseUrl, connectionOptions(databaseUrl, 1));
try {
  await migrate(drizzle(connection), { migrationsFolder: "drizzle" });
  await ensureRoles(databaseUrl);
} finally {
  await connection.end();
}
console.log("Migraciones aplicadas");
