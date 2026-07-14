import { parseRuntimeEnv, type RuntimeEnv } from "@kagura/config/env";
import { z } from "zod";

const authEnvSchema = z.object({
  SESSION_SECRET: z.string().min(32),
  SESSION_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  SESSION_TTL_HOURS: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 30),
});

const mediaEnvSchema = z.object({
  R2_ENDPOINT: z.url(),
  R2_REGION: z.string().trim().min(1).max(64),
  R2_BUCKET: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/),
  R2_PUBLIC_BASE_URL: z.url(),
  R2_ACCESS_KEY_ID: z.string().min(1).max(256),
  R2_SECRET_ACCESS_KEY: z.string().min(8).max(512),
  R2_FORCE_PATH_STYLE: z.enum(["true", "false"]).transform((value) => value === "true"),
  MEDIA_MAX_BYTES: z.coerce
    .number()
    .int()
    .min(1)
    .max(100 * 1024 * 1024),
  MEDIA_MAX_DIMENSION: z.coerce.number().int().min(1).max(16_384),
});

const webEnvSchema = authEnvSchema.extend(mediaEnvSchema.shape);

export type WebEnv = RuntimeEnv & z.infer<typeof webEnvSchema>;

export function getServerEnv(input: NodeJS.ProcessEnv = process.env): WebEnv {
  const runtime = parseRuntimeEnv(input);
  const webResult = webEnvSchema.safeParse(input);
  if (!webResult.success) {
    const invalidPaths = [
      ...new Set(webResult.error.issues.map((issue) => issue.path.join(".") || "<root>")),
    ];
    throw new Error(`Invalid web environment variables: ${invalidPaths.join(", ")}`);
  }

  return { ...runtime, ...webResult.data };
}
