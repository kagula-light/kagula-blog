import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

function verifyBundle(file, expectedError) {
  const result = spawnSync(process.execPath, [resolve(file)], {
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      APP_RELEASE: "bundle-verification",
    },
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

  if (output.includes("Dynamic require")) {
    throw new Error(`Worker ESM bundle ${file} cannot load CommonJS runtime dependencies`);
  }

  if (result.status !== 1 || !output.includes(expectedError)) {
    throw new Error(`Worker bundle ${file} did not reach application error handling`);
  }
}

verifyBundle("dist/migrate.js", "database migrations failed");
verifyBundle("dist/seed-admin.js", "administrator bootstrap failed");
