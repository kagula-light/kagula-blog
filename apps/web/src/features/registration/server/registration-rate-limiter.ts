import { createClient, type RedisClientType } from "redis";

const registrationWindowSeconds = 60 * 60;
const maximumRegistrations = 3;
const consumeRegistrationScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return { count, ttl }
`;

export interface RegistrationBudget {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

export interface RegistrationRateLimiter {
  readonly consumeRegistrationBudget: (key: string) => Promise<RegistrationBudget>;
}

export function evaluateRegistrationBudget(count: number, ttlSeconds: number): RegistrationBudget {
  if (count <= maximumRegistrations) return { allowed: true, retryAfterSeconds: 0 };
  return { allowed: false, retryAfterSeconds: Math.max(1, ttlSeconds) };
}

async function withRedis<T>(
  redisUrl: string,
  operation: (client: RedisClientType) => Promise<T>,
): Promise<T> {
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

export function createRegistrationRateLimiter(redisUrl: string): RegistrationRateLimiter {
  return {
    consumeRegistrationBudget: (key) =>
      withRedis(redisUrl, async (client) => {
        const result = await client.eval(consumeRegistrationScript, {
          keys: [key],
          arguments: [String(registrationWindowSeconds)],
        });
        if (!Array.isArray(result) || result.length !== 2) {
          throw new Error("Registration rate limiter returned an invalid result");
        }
        return evaluateRegistrationBudget(Number(result[0]), Number(result[1]));
      }),
  };
}
