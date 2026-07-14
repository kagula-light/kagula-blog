import { describe, expect, it, vi } from "vitest";

import { verifyTurnstile } from "./turnstile";

describe("verifyTurnstile", () => {
  it("submits the server secret, response token, and client address", async () => {
    let capturedUrl: string | URL | Request | undefined;
    let capturedRequest: RequestInit | undefined;
    const fetcher = vi.fn(async (url: string | URL | Request, request?: RequestInit) => {
      capturedUrl = url;
      capturedRequest = request;
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    await expect(
      verifyTurnstile(
        {
          secretKey: "turnstile-test-secret",
          responseToken: "turnstile-response",
          clientAddress: "203.0.113.21",
        },
        fetcher,
      ),
    ).resolves.toBe(true);

    expect(capturedUrl).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(capturedRequest?.method).toBe("POST");
    expect(capturedRequest?.body?.toString()).toContain("secret=turnstile-test-secret");
    expect(capturedRequest?.body?.toString()).toContain("response=turnstile-response");
    expect(capturedRequest?.body?.toString()).toContain("remoteip=203.0.113.21");
  });

  it("returns false for a non-success response", async () => {
    const fetcher = vi.fn(async () => new Response("unavailable", { status: 503 }));
    await expect(
      verifyTurnstile(
        { secretKey: "secret", responseToken: "response", clientAddress: "unknown" },
        fetcher,
      ),
    ).resolves.toBe(false);
  });

  it("returns false for malformed JSON without leaking the response", async () => {
    const fetcher = vi.fn(async () => new Response("not-json", { status: 200 }));
    await expect(
      verifyTurnstile(
        { secretKey: "secret", responseToken: "response", clientAddress: "unknown" },
        fetcher,
      ),
    ).resolves.toBe(false);
  });
});
