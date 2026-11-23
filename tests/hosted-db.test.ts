import { describe, expect, it } from "vitest";
import { assertMigrationConnection, isHostedDatabase, isTransactionPooler, quoteLiteral, rolePasswords } from "../src/db/hosted";

const direct = "postgresql://postgres:secret@db.abcdefghijklmnop.supabase.co:5432/postgres?sslmode=require";
const session = "postgresql://postgres.abcdefghijklmnop:secret@aws-0-sa-east-1.pooler.supabase.com:5432/postgres";
const transaction = "postgresql://postgres.abcdefghijklmnop:secret@aws-0-sa-east-1.pooler.supabase.com:6543/postgres";
const local = "postgres://postgres:postgres@127.0.0.1:5432/influencers_crm";

describe("conexión hosteada", () => {
  it("reconoce Supabase y el puerto 6543", () => {
    expect(isHostedDatabase(direct)).toBe(true);
    expect(isHostedDatabase(session)).toBe(true);
    expect(isHostedDatabase(local)).toBe(false);
    expect(isTransactionPooler(transaction)).toBe(true);
    expect(isTransactionPooler(session)).toBe(false);
  });

  it("pide contraseñas propias para Supabase y deja las locales en la compu", () => {
    const previousUser = process.env.APP_USER_PASSWORD;
    const previousJobs = process.env.APP_JOBS_PASSWORD;
    try {
      delete process.env.APP_USER_PASSWORD;
      delete process.env.APP_JOBS_PASSWORD;
      expect(rolePasswords(local)).toEqual({ appUser: "app_user_local", appJobs: "app_jobs_local" });
      expect(() => rolePasswords(direct)).toThrow(/APP_USER_PASSWORD/);
      process.env.APP_USER_PASSWORD = "app_user_local";
      process.env.APP_JOBS_PASSWORD = "una-clave-de-jobs-larga";
      expect(() => rolePasswords(direct)).toThrow(/locales/);
      process.env.APP_USER_PASSWORD = "una-clave-de-app-larga";
      process.env.APP_JOBS_PASSWORD = "una-clave-de-app-larga";
      expect(() => rolePasswords(direct)).toThrow(/distintas/);
      process.env.APP_JOBS_PASSWORD = "otra-clave-de-jobs-larga";
      expect(rolePasswords(direct)).toEqual({
        appUser: "una-clave-de-app-larga",
        appJobs: "otra-clave-de-jobs-larga",
      });
    } finally {
      if (previousUser === undefined) delete process.env.APP_USER_PASSWORD;
      else process.env.APP_USER_PASSWORD = previousUser;
      if (previousJobs === undefined) delete process.env.APP_JOBS_PASSWORD;
      else process.env.APP_JOBS_PASSWORD = previousJobs;
    }
  });

  it("no migra por el pooler de transacción y escapa comillas", () => {
    expect(() => assertMigrationConnection(transaction)).toThrow(/6543/);
    expect(() => assertMigrationConnection(session)).not.toThrow();
    expect(quoteLiteral("o'hara")).toBe("'o''hara'");
  });
});
