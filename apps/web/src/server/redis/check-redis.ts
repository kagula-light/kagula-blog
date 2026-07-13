import type { HealthCheck } from "@kagura/contracts/health";
import { createClient } from "redis";

export interface RedisReadinessOptions {
  readonly redisUrl: string;
  readonly clock?: () => number;
}

export async function checkRedisReadiness({
  redisUrl,
  clock = () => Date.now(),
}: RedisReadinessOptions): Promise<HealthCheck> {
  const startedAt = clock();
  const client = createClient({
    url: redisUrl,
    socket: {
      connectTimeout: 5_000,
      reconnectStrategy: false,
    },
  });
  client.on("error", () => undefined);

  try {
    await client.connect();
    await client.ping();
    return { status: "ok", durationMs: Math.max(0, clock() - startedAt) };
  } catch {
    return { status: "error", durationMs: Math.max(0, clock() - startedAt) };
  } finally {
    if (client.isOpen) {
      await client.quit().catch(() => client.destroy());
    }
  }
}
