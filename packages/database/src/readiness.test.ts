import { describe, expect, it, vi } from "vitest";

import { checkDatabaseReadiness } from "./readiness";

describe("checkDatabaseReadiness", () => {
  it("returns an ok health check when the injected query succeeds", async () => {
    const check = await checkDatabaseReadiness({
      execute: async () => undefined,
      now: (() => {
        let value = 100;
        return () => (value += 7);
      })(),
    });

    expect(check).toEqual({ status: "ok", durationMs: 7 });
  });

  it("returns an error health check when the injected query rejects", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const databaseUrl = "postgresql://user:secret@localhost/private";
    const check = await checkDatabaseReadiness({
      execute: async () => {
        throw new Error(`database unavailable at ${databaseUrl}`);
      },
      now: (() => {
        let value = 50;
        return () => (value += 3);
      })(),
    });

    expect(check.status).toBe("error");
    expect(check.durationMs).toBe(3);
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("never returns a negative duration when the clock moves backward", async () => {
    const check = await checkDatabaseReadiness({
      execute: async () => undefined,
      now: (() => {
        let value = 10;
        return () => (value -= 2);
      })(),
    });

    expect(check.durationMs).toBe(0);
  });
});
