import { describe, expect, it } from "vitest";

import { createHealthResponse, type HealthResponseInput } from "./health";

describe("createHealthResponse", () => {
  it("returns a serializable health response with checks", () => {
    const input = {
      service: "web",
      status: "ok",
      release: "abc123",
      timestamp: "2026-07-13T12:00:00.000Z",
      checks: {
        database: { status: "ok", durationMs: 12 },
        redis: { status: "ok", durationMs: 4 },
      },
    } as const satisfies HealthResponseInput;

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

    // @ts-expect-error Health response input is readonly at the TypeScript boundary.
    input.checks.database.status = "error";
  });
});
