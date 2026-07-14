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

export type WebEnv = RuntimeEnv & z.infer<typeof authEnvSchema>;

export function getServerEnv(input: NodeJS.ProcessEnv = process.env): WebEnv {
  const runtime = parseRuntimeEnv(input);
  const authResult = authEnvSchema.safeParse(input);
  if (!authResult.success) {
    const invalidPaths = [
      ...new Set(authResult.error.issues.map((issue) => issue.path.join(".") || "<root>")),
    ];
    throw new Error(`Invalid web environment variables: ${invalidPaths.join(", ")}`);
  }

  return { ...runtime, ...authResult.data };
}
