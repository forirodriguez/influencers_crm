import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { loadEnvFile } from "./load-env";
import { ensureRoles } from "./roles";

loadEnvFile();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL es obligatorio para migrar");
}

await ensureRoles(databaseUrl);
const connection = postgres(databaseUrl, { max: 1, onnotice: () => {} });
await migrate(drizzle(connection), { migrationsFolder: "drizzle" });
await connection.end();
console.log("Migraciones aplicadas");
