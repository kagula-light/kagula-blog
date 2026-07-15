import { describe, expect, it, vi } from "vitest";

import { createSourceFetcher } from "./source-fetcher";

describe("hotspot source fetcher", () => {
  it("fetches an allowlisted HTTPS document with bounded request options", async () => {
    const fetchImplementation = vi.fn(
      async () =>
        new Response('{"items":[]}', {
          status: 200,
          headers: { "content-type": "application/json", "content-length": "12" },
        }),
    );
    const fetcher = createSourceFetcher({ fetchImplementation });

    await expect(
      fetcher.fetchText({
        url: "https://api.example.com/list",
        allowedHosts: ["api.example.com"],
        acceptedContentTypes: ["application/json"],
      }),
    ).resolves.toEqual({ body: '{"items":[]}', contentType: "application/json" });
    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://api.example.com/list",
      expect.objectContaining({
        redirect: "manual",
        headers: expect.objectContaining({
          accept: "application/json",
          "user-agent": "KaguraBlogHotspotBot/1.0 (+metadata-only)",
        }),
      }),
    );
  });

  it.each([
    ["http://api.example.com/list", ["api.example.com"], "HTTPS"],
    ["https://evil.example/list", ["api.example.com"], "allowlist"],
    ["https://api.example.com.evil.example/list", ["api.example.com"], "allowlist"],
    ["https://user:secret@api.example.com/list", ["api.example.com"], "credentials"],
  ] as const)("rejects unsafe source URL %s", async (url, allowedHosts, message) => {
    const fetchImplementation = vi.fn();
    const fetcher = createSourceFetcher({ fetchImplementation });
    await expect(
      fetcher.fetchText({
        url,
        allowedHosts,
        acceptedContentTypes: ["application/json"],
      }),
    ).rejects.toThrow(message);
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("refuses redirects and unexpected content types", async () => {
    const redirectFetcher = createSourceFetcher({
      fetchImplementation: vi.fn(
        async () =>
          new Response(null, { status: 302, headers: { location: "https://evil.example" } }),
      ),
    });
    await expect(
      redirectFetcher.fetchText({
        url: "https://api.example.com/list",
        allowedHosts: ["api.example.com"],
        acceptedContentTypes: ["application/json"],
      }),
    ).rejects.toThrow("redirect");

    const htmlFetcher = createSourceFetcher({
      fetchImplementation: vi.fn(
        async () =>
          new Response("<html></html>", {
            status: 200,
            headers: { "content-type": "text/html" },
          }),
      ),
    });
    await expect(
      htmlFetcher.fetchText({
        url: "https://api.example.com/list",
        allowedHosts: ["api.example.com"],
        acceptedContentTypes: ["application/json"],
      }),
    ).rejects.toThrow("content type");
  });

  it("rejects declared and streamed responses above the byte budget", async () => {
    const declaredFetcher = createSourceFetcher({
      fetchImplementation: vi.fn(
        async () =>
          new Response("small", {
            status: 200,
            headers: { "content-type": "text/plain", "content-length": "2049" },
          }),
      ),
      maximumBytes: 2_048,
    });
    await expect(
      declaredFetcher.fetchText({
        url: "https://api.example.com/list",
        allowedHosts: ["api.example.com"],
        acceptedContentTypes: ["text/plain"],
      }),
    ).rejects.toThrow("size");

    const streamedFetcher = createSourceFetcher({
      fetchImplementation: vi.fn(
        async () =>
          new Response(new Uint8Array(2_049), {
            status: 200,
            headers: { "content-type": "application/octet-stream" },
          }),
      ),
      maximumBytes: 2_048,
    });
    await expect(
      streamedFetcher.fetchText({
        url: "https://api.example.com/list",
        allowedHosts: ["api.example.com"],
        acceptedContentTypes: ["application/octet-stream"],
      }),
    ).rejects.toThrow("size");
  });

  it("aborts a source request after its timeout", async () => {
    const fetchImplementation = vi.fn(
      async (_url: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
            once: true,
          });
        }),
    );
    const fetcher = createSourceFetcher({ fetchImplementation, timeoutMs: 10 });
    await expect(
      fetcher.fetchText({
        url: "https://api.example.com/list",
        allowedHosts: ["api.example.com"],
        acceptedContentTypes: ["application/json"],
      }),
    ).rejects.toThrow("timed out");
  });
});
