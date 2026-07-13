import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const result = spawnSync(process.execPath, [resolve("dist/migrate.js")], {
  encoding: "utf8",
  env: {
    PATH: process.env.PATH,
    APP_RELEASE: "bundle-verification",
  },
});
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

if (output.includes("Dynamic require")) {
  throw new Error("Worker ESM bundle cannot load CommonJS runtime dependencies");
}

if (result.status !== 1 || !output.includes("database migrations failed")) {
  throw new Error("Worker migration bundle did not reach application error handling");
}
