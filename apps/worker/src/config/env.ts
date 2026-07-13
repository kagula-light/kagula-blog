import { parseRuntimeEnv, type RuntimeEnv } from "@kagura/config/env";

export interface WorkerEnv extends RuntimeEnv {
  readonly WORKER_HEALTH_PORT: number;
}

export function parseWorkerEnv(input: NodeJS.ProcessEnv = process.env): WorkerEnv {
  const runtime = parseRuntimeEnv(input);
  const workerHealthPort = Number(input.WORKER_HEALTH_PORT);

  if (!Number.isInteger(workerHealthPort) || workerHealthPort < 1 || workerHealthPort > 65_535) {
    throw new Error("Invalid worker environment variables: WORKER_HEALTH_PORT");
  }

  return { ...runtime, WORKER_HEALTH_PORT: workerHealthPort };
}
