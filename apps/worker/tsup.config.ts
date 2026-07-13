import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/migrate.ts", "src/seed-admin.ts"],
  format: ["esm"],
  sourcemap: true,
  dts: true,
  clean: true,
  noExternal: [/^@kagura\//],
  external: ["@node-rs/argon2"],
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
  },
});
