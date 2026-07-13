import { isIP } from "node:net";

import { z } from "zod";

const databaseUrlSchema = z.url().refine(
  (value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "postgres:" || protocol === "postgresql:";
    } catch {
      return false;
    }
  },
  { message: "DATABASE_URL must use postgres:// or postgresql://" },
);

const redisUrlSchema = z.url().refine(
  (value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "redis:" || protocol === "rediss:";
    } catch {
      return false;
    }
  },
  { message: "REDIS_URL must use redis:// or rediss://" },
);

function isLoopbackHostname(hostname: string): boolean {
  const normalizedHostname = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (normalizedHostname === "localhost") {
    return true;
  }

  const ipVersion = isIP(normalizedHostname);
  if (ipVersion === 4) {
    return normalizedHostname.startsWith("127.");
  }

  if (ipVersion !== 6) {
    return false;
  }

  return (
    normalizedHostname === "::1" || /^::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}$/.test(normalizedHostname)
  );
}

const runtimeEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]),
    APP_URL: z.url(),
    APP_TIMEZONE: z.string().min(1),
    APP_RELEASE: z.string().min(1),
    LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]),
    DATABASE_URL: databaseUrlSchema,
    REDIS_URL: redisUrlSchema,
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV !== "production") {
      return;
    }

    const appUrl = new URL(env.APP_URL);
    if (appUrl.protocol !== "https:" && !isLoopbackHostname(appUrl.hostname)) {
      context.addIssue({
        code: "custom",
        path: ["APP_URL"],
        message: "Production APP_URL must use HTTPS unless it targets a loopback host",
      });
    }
  });

export type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;

export const runtimeEnv = runtimeEnvSchema;

export function parseRuntimeEnv(input: unknown): RuntimeEnv {
  const result = runtimeEnvSchema.safeParse(input);
  if (result.success) {
    return result.data;
  }

  const invalidPaths = [
    ...new Set(result.error.issues.map((issue) => issue.path.join(".") || "<root>")),
  ];
  throw new Error(`Invalid runtime environment variables: ${invalidPaths.join(", ")}`);
}
