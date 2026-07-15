import { createHealthResponse } from "@kagura/contracts/health";
import { createDatabaseClient } from "@kagura/database/client";
import { checkDatabaseReadiness } from "@kagura/database/readiness";
import pino from "pino";

import { parseWorkerEnv } from "./config/env";
import { checkReadiness } from "./health/check-readiness";
import { createHealthServer } from "./health/create-health-server";
import { collectHotspots } from "./hotspots/collect-hotspots";
import { createHotspotCollectionRepository } from "./hotspots/hotspot-repository";
import { startHotspotCollectionSchedule } from "./jobs/collect-hotspots-schedule";
import {
  createScheduledPostPublisher,
  publishScheduledPosts,
} from "./jobs/publish-scheduled-posts";
import { createRedisAdapter } from "./redis/create-redis-adapter";

async function startWorker(): Promise<void> {
  const env = parseWorkerEnv();
  const logger = pino({
    level: env.LOG_LEVEL,
    base: { service: "worker", release: env.APP_RELEASE },
  });
  const database = createDatabaseClient(env.DATABASE_URL);
  const redis = createRedisAdapter({ redisUrl: env.REDIS_URL });
  const scheduledPublisher = createScheduledPostPublisher(database);
  const hotspotRepository = createHotspotCollectionRepository(database);

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
  const scheduledPublishTimer = setInterval(() => {
    void publishScheduledPosts(scheduledPublisher)
      .then((publishedCount) => {
        if (publishedCount > 0) logger.info({ publishedCount }, "scheduled posts published");
      })
      .catch(() => {
        logger.warn("scheduled post publication failed");
      });
  }, 60_000);
  scheduledPublishTimer.unref();
  healthServer.listen();
  const hotspotSchedule = startHotspotCollectionSchedule({
    enabled: env.HOTSPOT_COLLECTION_ENABLED,
    collect: async () => {
      const summary = await collectHotspots({ repository: hotspotRepository });
      logger.info(summary, "hotspot collection completed");
    },
    onFailure: () => {
      logger.warn("hotspot collection failed before source isolation");
    },
  });
  logger.info({ port: env.WORKER_HEALTH_PORT }, "worker health server started");

  const shutdown = (): Promise<void> => {
    shutdownPromise ??= (async () => {
      clearInterval(scheduledPublishTimer);
      hotspotSchedule.stop();
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
}

startWorker().catch(() => {
  process.exitCode = 1;
});
