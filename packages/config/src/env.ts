import { z } from "zod";

const runtimeEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]),
    APP_URL: z.url(),
    APP_TIMEZONE: z.string().min(1),
    APP_RELEASE: z.string().min(1),
    LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]),
    DATABASE_URL: z.url(),
    REDIS_URL: z.url(),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV !== "production") {
      return;
    }

    const appUrl = new URL(env.APP_URL);
    const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
    if (appUrl.protocol !== "https:" && !loopbackHosts.has(appUrl.hostname)) {
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
