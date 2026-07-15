import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const workspaceSource = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@kagula/contracts/hotspots": workspaceSource("../../packages/contracts/src/hotspots.ts"),
      "@kagula/database/client": workspaceSource("../../packages/database/src/client.ts"),
      "@kagula/database/migrate": workspaceSource("../../packages/database/src/migrate.ts"),
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
