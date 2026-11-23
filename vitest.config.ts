import { defineConfig } from "vitest/config";
import path from "node:path";
import { testAppUrl, testDatabaseUrl, testJobsUrl } from "./tests/db-url";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
    globalSetup: ["./tests/global-setup.ts"],
    env: {
      DATABASE_URL: testDatabaseUrl,
      DATABASE_URL_APP: testAppUrl,
      DATABASE_URL_JOBS: testJobsUrl,
      AUTH_SECRET: "test-auth-secret-32chars-minimum",
      AUTH_MODE: "local",
      AUTH_DEV_EXPOSE_LINKS: "true",
      TOKEN_ENCRYPTION_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
      INTEGRATIONS_MODE: "mock",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      WHATSAPP_APP_SECRET: "test-whatsapp-secret",
      WHATSAPP_VERIFY_TOKEN: "dev-verify-token",
      EMAIL_FROM: "influencers_crm <noreply@localhost>",
    },
  },
});
