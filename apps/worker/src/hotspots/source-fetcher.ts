export interface SourceFetchRequest {
  readonly url: string;
  readonly allowedHosts: readonly string[];
  readonly acceptedContentTypes: readonly string[];
}

export interface SourceDocument {
  readonly body: string;
  readonly contentType: string;
}

export interface SourceFetcher {
  readonly fetchText: (request: SourceFetchRequest) => Promise<SourceDocument>;
}

export interface SourceFetcherDependencies {
  readonly fetchImplementation?: typeof fetch;
  readonly timeoutMs?: number;
  readonly maximumBytes?: number;
  readonly userAgent?: string;
}

const defaultUserAgent = "KaguraBlogHotspotBot/1.0 (+metadata-only)";

function validateSourceUrl(value: string, allowedHosts: readonly string[]): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("source URL is invalid");
  }
  if (url.protocol !== "https:") throw new Error("source URL must use HTTPS");
  if (url.username || url.password) throw new Error("source URL must not contain credentials");
  if (url.port && url.port !== "443") throw new Error("source URL port is not allowed");
  const allowlist = new Set(allowedHosts.map((host) => host.toLowerCase()));
  if (!allowlist.has(url.hostname.toLowerCase())) {
    throw new Error("source URL host is outside the allowlist");
  }
  return url;
}

async function readBoundedBody(response: Response, maximumBytes: number): Promise<string> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null) {
    const length = Number.parseInt(declaredLength, 10);
    if (Number.isFinite(length) && length > maximumBytes) {
      throw new Error("source response size exceeds the byte budget");
    }
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let body = "";
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel();
        throw new Error("source response size exceeds the byte budget");
      }
      body += decoder.decode(result.value, { stream: true });
    }
    body += decoder.decode();
    return body;
  } finally {
    reader.releaseLock();
  }
}

export function createSourceFetcher({
  fetchImplementation = fetch,
  timeoutMs = 8_000,
  maximumBytes = 2 * 1_024 * 1_024,
  userAgent = defaultUserAgent,
}: SourceFetcherDependencies = {}): SourceFetcher {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) {
    throw new Error("source timeout must be between 1 and 30000 milliseconds");
  }
  if (!Number.isInteger(maximumBytes) || maximumBytes < 1) {
    throw new Error("source byte budget must be a positive integer");
  }

  return {
    fetchText: async (request) => {
      const url = validateSourceUrl(request.url, request.allowedHosts);
      const acceptedTypes = request.acceptedContentTypes.map((value) => value.toLowerCase());
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort(new Error("source request timed out"));
      }, timeoutMs);

      try {
        const response = await fetchImplementation(url.toString(), {
          redirect: "manual",
          signal: controller.signal,
          headers: {
            accept: acceptedTypes.join(", "),
            "user-agent": userAgent,
          },
        });
        if (response.status >= 300 && response.status < 400) {
          throw new Error("source redirect was refused");
        }
        if (!response.ok) throw new Error(`source request failed with status ${response.status}`);

        const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.toLowerCase();
        if (!contentType || !acceptedTypes.includes(contentType)) {
          throw new Error("source response content type is not accepted");
        }
        return {
          body: await readBoundedBody(response, maximumBytes),
          contentType,
        };
      } catch (error) {
        if (controller.signal.aborted) throw new Error("source request timed out");
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
