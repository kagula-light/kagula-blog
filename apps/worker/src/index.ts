import { createHealthResponse } from "@kagura/contracts/health";
import { createDatabaseClient } from "@kagura/database/client";
import { checkDatabaseReadiness } from "@kagura/database/readiness";
import pino from "pino";

import { parseWorkerEnv } from "./config/env";
import { checkReadiness } from "./health/check-readiness";
import { createHealthServer } from "./health/create-health-server";
import { createRedisAdapter } from "./redis/create-redis-adapter";

async function startWorker(): Promise<void> {
  const env = parseWorkerEnv();
  const logger = pino({
    level: env.LOG_LEVEL,
    base: { service: "worker", release: env.APP_RELEASE },
  });
  const database = createDatabaseClient(env.DATABASE_URL);
  const redis = createRedisAdapter({ redisUrl: env.REDIS_URL });

  const healthServer = createHealthServer({
    port: env.WORKER_HEALTH_PORT,
    getLiveness: () =>
      createHealthResponse({
        service: "worker",
        status: "ok",
        release: env.APP_RELEASE,
        timestamp: new Date().toISOString(),
      }),
    getReadiness: async () =>
      checkReadiness({
        release: env.APP_RELEASE,
        checkDatabase: async () =>
          checkDatabaseReadiness({ execute: async () => database.client`select 1` }),
        checkRedis: redis.checkReadiness,
      }),
  });

  let shutdownPromise: Promise<void> | undefined;
  const shutdown = (): Promise<void> => {
    shutdownPromise ??= (async () => {
      await healthServer.close();
      await redis.close();
      await database.close();
      logger.flush();
    })();
    return shutdownPromise;
  };

  const handleSignal = (): void => {
    void shutdown().catch(() => {
      process.exitCode = 1;
    });
  };
  process.once("SIGTERM", handleSignal);
  process.once("SIGINT", handleSignal);

  healthServer.listen();
  logger.info({ port: env.WORKER_HEALTH_PORT }, "worker health server started");
}

startWorker().catch(() => {
  process.exitCode = 1;
});
