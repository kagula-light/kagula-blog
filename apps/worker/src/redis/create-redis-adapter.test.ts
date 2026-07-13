import { describe, expect, it, vi } from "vitest";

import { createRedisAdapter, type RedisClient } from "./create-redis-adapter";

function createFakeClient(connect: () => Promise<void>, ping: () => Promise<string>): RedisClient {
  let open = false;
  return {
    get isOpen() {
      return open;
    },
    on: vi.fn(),
    connect: async () => {
      await connect();
      open = true;
    },
    ping,
    quit: vi.fn(async () => {
      open = false;
      return "OK";
    }),
    destroy: vi.fn(() => {
      open = false;
    }),
  };
}

describe("createRedisAdapter", () => {
  it("replaces a closed client after failure so readiness can recover", async () => {
    const failedClient = createFakeClient(
      async () => {
        throw new Error("offline");
      },
      async () => "PONG",
    );
    const recoveredClient = createFakeClient(
      async () => undefined,
      async () => "PONG",
    );
    const createClient = vi
      .fn<() => RedisClient>()
      .mockReturnValueOnce(failedClient)
      .mockReturnValueOnce(recoveredClient);
    const adapter = createRedisAdapter({ redisUrl: "redis://localhost", createClient });

    expect((await adapter.checkReadiness()).status).toBe("error");
    expect((await adapter.checkReadiness()).status).toBe("ok");
    expect(createClient).toHaveBeenCalledTimes(2);
  });

  it("closes an open client once", async () => {
    const client = createFakeClient(
      async () => undefined,
      async () => "PONG",
    );
    const adapter = createRedisAdapter({
      redisUrl: "redis://localhost",
      createClient: () => client,
    });

    await adapter.checkReadiness();
    await adapter.close();
    await adapter.close();

    expect(client.quit).toHaveBeenCalledOnce();
  });
});
