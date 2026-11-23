import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "drizzle/**"]),
  {
    files: ["src/modules/crm/**/*.{ts,tsx}", "src/modules/media-kit/**/*.{ts,tsx}", "src/modules/reminders/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/db/admin",
              message: "Los módulos de producto usan withUser o withJobs. El rol admin queda en identity, migraciones y seed.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
