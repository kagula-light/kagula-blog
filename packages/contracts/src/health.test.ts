import { describe, expect, it } from "vitest";

import {
  createHealthResponse,
  type HealthResponse,
  type HealthResponseInput,
  type HealthStatus,
} from "./health";

function assertReadonlyContracts(input: HealthResponseInput, response: HealthResponse): void {
  // @ts-expect-error Health response input properties are readonly.
  input.service = "worker";
  // @ts-expect-error Health response input properties are readonly.
  input.checks = {};

  const databaseCheck = input.checks?.database;
  if (databaseCheck) {
    // @ts-expect-error Health checks are readonly.
    databaseCheck.status = "error";
  }

  // @ts-expect-error Health response properties are readonly.
  response.release = "next-release";

  // @ts-expect-error exactOptionalPropertyTypes requires omitting checks instead of assigning undefined.
  const responseWithUndefinedChecks: HealthResponse = {
    service: "web",
    status: "ok",
    release: "abc123",
    timestamp: "2026-07-13T12:00:00.000Z",
    checks: undefined,
  };
  void responseWithUndefinedChecks;
}

describe("createHealthResponse", () => {
  it("returns a serializable health response with checks", () => {
    const input: HealthResponseInput = {
      service: "web",
      status: "ok",
      release: "abc123",
      timestamp: "2026-07-13T12:00:00.000Z",
      checks: {
        database: { status: "ok", durationMs: 12 },
        redis: { status: "ok", durationMs: 4 },
      },
    };

    const response = createHealthResponse(input);

    expect(response).toEqual({
      service: "web",
      status: "ok",
      release: "abc123",
      timestamp: "2026-07-13T12:00:00.000Z",
      checks: {
        database: { status: "ok", durationMs: 12 },
        redis: { status: "ok", durationMs: 4 },
      },
    });

    assertReadonlyContracts(input, response);
  });

  it("does not alias a mutable checks record", () => {
    const checks: Record<string, { status: HealthStatus; durationMs: number }> = {
      database: { status: "ok", durationMs: 12 },
    };

    const response = createHealthResponse({
      service: "web",
      status: "ok",
      release: "abc123",
      timestamp: "2026-07-13T12:00:00.000Z",
      checks,
    });

    const databaseCheck = checks.database;
    if (!databaseCheck) {
      throw new Error("database check fixture is missing");
    }

    databaseCheck.status = "error";
    databaseCheck.durationMs = 99;

    expect(response.checks).toEqual({
      database: { status: "ok", durationMs: 12 },
    });
  });

  it("projects checks to the stable health check fields", () => {
    const checks: Record<string, { status: HealthStatus; durationMs: number; detail: string }> = {
      database: { status: "ok", durationMs: 12, detail: "omit this" },
    };

    const response = createHealthResponse({
      service: "worker",
      status: "ok",
      release: "abc123",
      timestamp: "2026-07-13T12:00:00.000Z",
      checks,
    });

    expect(response.checks).toEqual({
      database: { status: "ok", durationMs: 12 },
    });
  });

  it("omits checks when no checks are supplied", () => {
    expect(
      createHealthResponse({
        service: "web",
        status: "ok",
        release: "abc123",
        timestamp: "2026-07-13T12:00:00.000Z",
      }),
    ).toEqual({
      service: "web",
      status: "ok",
      release: "abc123",
      timestamp: "2026-07-13T12:00:00.000Z",
    });
  });
});
