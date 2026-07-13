import {
  createHealthResponse,
  type HealthCheck,
  type HealthResponse,
} from "@kagura/contracts/health";

export interface CheckReadinessOptions {
  readonly checkDatabase: () => Promise<HealthCheck>;
  readonly checkRedis: () => Promise<HealthCheck>;
  readonly release?: string;
  readonly clock?: () => Date;
}

export async function checkReadiness({
  checkDatabase,
  checkRedis,
  release = "dev",
  clock = () => new Date(),
}: CheckReadinessOptions): Promise<HealthResponse> {
  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);
  const status = database.status === "ok" && redis.status === "ok" ? "ok" : "error";

  return createHealthResponse({
    service: "web",
    status,
    release,
    timestamp: clock().toISOString(),
    checks: { database, redis },
  });
}
