import type { HealthCheck } from "@kagura/contracts/health";

export interface DatabaseReadinessOptions {
  readonly execute: () => Promise<unknown>;
  readonly now?: () => number;
  readonly clock?: () => number;
}

export async function checkDatabaseReadiness(
  options: DatabaseReadinessOptions,
): Promise<HealthCheck> {
  const now = options.now ?? options.clock ?? (() => Date.now());
  const startedAt = now();

  try {
    await options.execute();
    return {
      status: "ok",
      durationMs: Math.max(0, now() - startedAt),
    };
  } catch {
    return {
      status: "error",
      durationMs: Math.max(0, now() - startedAt),
    };
  }
}
