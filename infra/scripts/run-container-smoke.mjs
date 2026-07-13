import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const composeArgs = ["compose", "-p", "kagura-blog-smoke", "-f", "infra/docker/compose.smoke.yml"];

function run(args, options = {}) {
  return spawnSync("docker", [...composeArgs, ...args], {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
}

let failed = false;
try {
  const startup = run([
    "up",
    "--build",
    "-d",
    "--wait",
    "--wait-timeout",
    "120",
    "postgres",
    "redis",
    "migrate",
    "web",
    "worker",
  ]);
  if (startup.status !== 0) {
    failed = true;
    process.exitCode = startup.status ?? 1;
  } else {
    const smoke = run(["run", "--rm", "smoke"]);
    failed = smoke.status !== 0;
    process.exitCode = smoke.status ?? 1;
  }
} finally {
  if (failed) {
    const logs = spawnSync("docker", [...composeArgs, "logs", "--no-color"], {
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    writeFileSync("container-smoke.log", `${logs.stdout ?? ""}${logs.stderr ?? ""}`);
  }
  run(["down", "--volumes", "--remove-orphans"]);
}
