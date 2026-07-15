import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const workspaceSource = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@kagula/auth/password": workspaceSource("../../packages/auth/src/password.ts"),
      "@kagula/auth/session-token": workspaceSource("../../packages/auth/src/session-token.ts"),
      "@kagula/auth/username": workspaceSource("../../packages/auth/src/username.ts"),
      "@kagula/config/env": workspaceSource("../../packages/config/src/env.ts"),
      "@kagula/contracts/health": workspaceSource("../../packages/contracts/src/health.ts"),
      "@kagula/database/client": workspaceSource("../../packages/database/src/client.ts"),
      "@kagula/database/migrate": workspaceSource("../../packages/database/src/migrate.ts"),
      "@kagula/database/readiness": workspaceSource("../../packages/database/src/readiness.ts"),
      "@kagula/database/schema": workspaceSource("../../packages/database/src/schema.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.integration.test.ts"],
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
