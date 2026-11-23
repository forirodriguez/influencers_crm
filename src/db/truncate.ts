import type { Sql } from "postgres";

export async function truncatePublicTables(connection: Sql): Promise<void> {
  const rows = await connection<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public'
  `;
  if (rows.length === 0) return;
  const list = rows.map((row) => `"${row.tablename.replaceAll('"', "")}"`).join(", ");
  await connection.unsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
