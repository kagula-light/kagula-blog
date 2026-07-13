import { createClient, type RedisClientType } from "redis";

const failureWindowSeconds = 10 * 60;
const maximumFailures = 5;
const recordFailureScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
`;

export interface FailureBudget {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

export interface LoginFailureLimiter {
  readonly consumeFailureBudget: (key: string) => Promise<FailureBudget>;
  readonly recordFailure: (key: string) => Promise<void>;
  readonly clearFailures: (key: string) => Promise<void>;
}

export function evaluateFailureBudget(count: number, ttlSeconds: number): FailureBudget {
  if (count < maximumFailures) return { allowed: true, retryAfterSeconds: 0 };
  return { allowed: false, retryAfterSeconds: Math.max(1, ttlSeconds) };
}

async function withRedis<T>(redisUrl: string, operation: (client: RedisClientType) => Promise<T>): Promise<T> {
  const client = createClient({
    url: redisUrl,
    socket: { connectTimeout: 5_000, reconnectStrategy: false },
  });
  client.on("error", () => undefined);

  try {
    await client.connect();
    return await operation(client);
  } finally {
    if (client.isOpen) await client.quit().catch(() => client.destroy());
  }
}

export function createLoginFailureLimiter(redisUrl: string): LoginFailureLimiter {
  return {
    consumeFailureBudget: (key) =>
      withRedis(redisUrl, async (client) => {
        const [countValue, ttlSeconds] = await Promise.all([client.get(key), client.ttl(key)]);
        return evaluateFailureBudget(Number(countValue ?? 0), ttlSeconds);
      }),

    recordFailure: (key) =>
      withRedis(redisUrl, async (client) => {
        await client.eval(recordFailureScript, {
          keys: [key],
          arguments: [String(failureWindowSeconds)],
        });
      }),

    clearFailures: (key) =>
      withRedis(redisUrl, async (client) => {
        await client.del(key);
      }),
  };
}
