import type { HealthCheck } from "@kagura/contracts/health";
import { describe, expect, it, vi } from "vitest";

import { checkReadiness } from "./check-readiness";

const okCheck: HealthCheck = { status: "ok", durationMs: 1 };
const errorCheck: HealthCheck = { status: "error", durationMs: 2 };

describe("checkReadiness", () => {
  it("returns ok after both checks succeed", async () => {
    const checkDatabase = vi.fn(async () => okCheck);
    const checkRedis = vi.fn(async () => okCheck);

    const response = await checkReadiness({
      checkDatabase,
      checkRedis,
      release: "worker-test",
      clock: () => new Date("2026-07-13T00:00:00.000Z"),
    });

    expect(response).toEqual({
      service: "worker",
      status: "ok",
      release: "worker-test",
      timestamp: "2026-07-13T00:00:00.000Z",
      checks: { database: okCheck, redis: okCheck },
    });
    expect(checkDatabase).toHaveBeenCalledOnce();
    expect(checkRedis).toHaveBeenCalledOnce();
  });

  it("returns error for a database failure and still checks Redis", async () => {
    const checkDatabase = vi.fn(async () => errorCheck);
    const checkRedis = vi.fn(async () => okCheck);

    const response = await checkReadiness({ checkDatabase, checkRedis });

    expect(response.status).toBe("error");
    expect(checkRedis).toHaveBeenCalledOnce();
  });

  it("returns error for a Redis failure and still checks the database", async () => {
    const checkDatabase = vi.fn(async () => okCheck);
    const checkRedis = vi.fn(async () => errorCheck);

    const response = await checkReadiness({ checkDatabase, checkRedis });

    expect(response.status).toBe("error");
    expect(checkDatabase).toHaveBeenCalledOnce();
  });
});
