import { once } from "node:events";

import { createHealthResponse } from "@kagura/contracts/health";
import { afterEach, describe, expect, it } from "vitest";

import { createHealthServer, type HealthServer } from "./create-health-server";

let healthServer: HealthServer | undefined;

afterEach(async () => {
  await healthServer?.close();
  healthServer = undefined;
});

describe("createHealthServer", () => {
  it("maps liveness, readiness, and unknown paths", async () => {
    healthServer = createHealthServer({
      port: 0,
      getLiveness: () =>
        createHealthResponse({
          service: "worker",
          status: "ok",
          release: "test",
          timestamp: "2026-07-13T00:00:00.000Z",
        }),
      getReadiness: async () =>
        createHealthResponse({
          service: "worker",
          status: "ok",
          release: "test",
          timestamp: "2026-07-13T00:00:00.000Z",
        }),
    });
    healthServer.listen();
    await once(healthServer.server, "listening");

    const port = healthServer.port();
    const live = await fetch(`http://127.0.0.1:${port}/health/live`);
    const ready = await fetch(`http://127.0.0.1:${port}/health/ready`);
    const missing = await fetch(`http://127.0.0.1:${port}/missing`);

    expect(live.status).toBe(200);
    expect(live.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(ready.status).toBe(200);
    expect(missing.status).toBe(404);
  });

  it("maps error readiness to 503 and closes cleanly", async () => {
    healthServer = createHealthServer({
      port: 0,
      getLiveness: () =>
        createHealthResponse({
          service: "worker",
          status: "ok",
          release: "test",
          timestamp: "2026-07-13T00:00:00.000Z",
        }),
      getReadiness: async () =>
        createHealthResponse({
          service: "worker",
          status: "error",
          release: "test",
          timestamp: "2026-07-13T00:00:00.000Z",
        }),
    });
    healthServer.listen();
    await once(healthServer.server, "listening");

    const response = await fetch(`http://127.0.0.1:${healthServer.port()}/health/ready`);
    expect(response.status).toBe(503);

    await healthServer.close();
    expect(healthServer.server.listening).toBe(false);
    healthServer = undefined;
  });
});
