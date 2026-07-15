import { parseRuntimeEnv, type RuntimeEnv } from "@kagura/config/env";

export interface WorkerEnv extends RuntimeEnv {
  readonly WORKER_HEALTH_PORT: number;
  readonly HOTSPOT_COLLECTION_ENABLED: boolean;
}

export function parseWorkerEnv(input: NodeJS.ProcessEnv = process.env): WorkerEnv {
  const runtime = parseRuntimeEnv(input);
  const workerHealthPort = Number(input.WORKER_HEALTH_PORT);
  const hotspotCollectionFlag =
    input.HOTSPOT_COLLECTION_ENABLED ?? (runtime.NODE_ENV === "production" ? "true" : "false");

  if (!Number.isInteger(workerHealthPort) || workerHealthPort < 1 || workerHealthPort > 65_535) {
    throw new Error("Invalid worker environment variables: WORKER_HEALTH_PORT");
  }
  if (hotspotCollectionFlag !== "true" && hotspotCollectionFlag !== "false") {
    throw new Error("Invalid worker environment variables: HOTSPOT_COLLECTION_ENABLED");
  }

  return {
    ...runtime,
    WORKER_HEALTH_PORT: workerHealthPort,
    HOTSPOT_COLLECTION_ENABLED: hotspotCollectionFlag === "true",
  };
}
