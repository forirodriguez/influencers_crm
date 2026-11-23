import type postgres from "postgres";
import { isHostedDatabase, isTransactionPooler } from "./hosted";

export function connectionOptions(databaseUrl: string, max = 1): postgres.Options<Record<string, never>> {
  const hosted = isHostedDatabase(databaseUrl);
  return {
    max,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: isTransactionPooler(databaseUrl) ? false : true,
    ssl: hosted ? "require" : undefined,
    onnotice: () => {},
  };
}
