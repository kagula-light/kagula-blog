import type { HealthCheck } from "@kagura/contracts/health";

export interface DatabaseReadinessOptions {
  readonly execute: () => Promise<unknown>;
  readonly clock?: () => number;
}

export async function checkDatabaseReadiness(
  options: DatabaseReadinessOptions,
): Promise<HealthCheck> {
  const clock = options.clock ?? (() => Date.now());
  const startedAt = clock();

  try {
    await options.execute();
    return {
      status: "ok",
      durationMs: Math.max(0, clock() - startedAt),
    };
  } catch {
    return {
      status: "error",
      durationMs: Math.max(0, clock() - startedAt),
    };
  }
}
