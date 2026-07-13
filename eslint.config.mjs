import { defineConfig, globalIgnores } from "eslint/config";
import { createRequire } from "node:module";
import nextTypescript from "eslint-config-next/typescript";

const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve("eslint-config-next"));
const reactHooks = nextRequire("eslint-plugin-react-hooks");

let nextVitals = [];
try {
  nextVitals = (await import("eslint-config-next/core-web-vitals")).default;
} catch (error) {
  const message = error instanceof Error ? error.message : "";
  if (!message.includes("next/dist/compiled/babel/eslint-parser")) {
    throw error;
  }
}

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    files: ["**/*.generated.{js,jsx,ts,tsx}", "**/generated/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  globalIgnores([
    "**/.next/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/playwright-report/**",
    "**/test-results/**",
    "**/blob-report/**",
    "packages/database/drizzle/**",
  ]),
]);
