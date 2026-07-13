import type { HealthCheck } from "@kagura/contracts/health";
import { createClient as createNodeRedisClient } from "redis";

export interface RedisClient {
  readonly isOpen: boolean;
  readonly on: (event: "error", listener: () => void) => unknown;
  readonly connect: () => Promise<unknown>;
  readonly ping: () => Promise<string>;
  readonly quit: () => Promise<unknown>;
  readonly destroy: () => void;
}

export interface CreateRedisAdapterOptions {
  readonly redisUrl: string;
  readonly createClient?: () => RedisClient;
  readonly clock?: () => number;
}

export interface RedisAdapter {
  readonly checkReadiness: () => Promise<HealthCheck>;
  readonly close: () => Promise<void>;
}

export function createRedisAdapter({
  redisUrl,
  createClient = () =>
    createNodeRedisClient({
      url: redisUrl,
      socket: { connectTimeout: 5_000, reconnectStrategy: false },
    }),
  clock = () => Date.now(),
}: CreateRedisAdapterOptions): RedisAdapter {
  let client: RedisClient | undefined;
  let closed = false;

  const getClient = (): RedisClient => {
    if (!client) {
      client = createClient();
      client.on("error", () => undefined);
    }
    return client;
  };

  return {
    checkReadiness: async () => {
      const startedAt = clock();
      try {
        const activeClient = getClient();
        if (!activeClient.isOpen) {
          await activeClient.connect();
        }
        await activeClient.ping();
        return { status: "ok", durationMs: Math.max(0, clock() - startedAt) };
      } catch {
        if (client && !client.isOpen) {
          client = undefined;
        }
        return { status: "error", durationMs: Math.max(0, clock() - startedAt) };
      }
    },
    close: async () => {
      if (closed) {
        return;
      }
      closed = true;
      if (client?.isOpen) {
        await client.quit().catch(() => client?.destroy());
      }
      client = undefined;
    },
  };
}
