import { sql as drizzleSql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { getEnv } from "../lib/env.server";
import { schema } from "./schema";
import type { Db } from "./types";

const pools = new Map<string, Sql>();

function pool(url: string): Sql {
  const existing = pools.get(url);
  if (existing) return existing;
  const created = postgres(url, { max: 5, idle_timeout: 20, connect_timeout: 10 });
  pools.set(url, created);
  return created;
}

export function getAppDb(): Db {
  return drizzle(pool(getEnv().DATABASE_URL_APP), { schema });
}

export function getJobsDb(): Db {
  return drizzle(pool(getEnv().DATABASE_URL_JOBS), { schema });
}

export function getAdminDb(): Db {
  return drizzle(pool(getEnv().DATABASE_URL), { schema });
}

export async function withUser<T>(userId: string, fn: (db: Db) => Promise<T>): Promise<T> {
  return getAppDb().transaction(async (tx) => {
    await tx.execute(drizzleSql`select set_config('app.user_id', ${userId}, true)`);
    return fn(tx as unknown as Db);
  });
}

export async function withAdmin<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  return getAdminDb().transaction(async (tx) => fn(tx as unknown as Db));
}

export async function closePools(): Promise<void> {
  await Promise.all([...pools.values()].map((connection) => connection.end({ timeout: 5 })));
  pools.clear();
}
