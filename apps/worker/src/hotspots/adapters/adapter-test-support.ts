import { readFile } from "node:fs/promises";

import type { SourceFetcher } from "../source-fetcher";

export async function readFixture(relativePath: string): Promise<string> {
  return readFile(new URL(`../fixtures/${relativePath}`, import.meta.url), "utf8");
}

export function createFixtureFetcher(
  resolveBody: (url: string) => string | Promise<string>,
): SourceFetcher {
  return {
    fetchText: async ({ url, acceptedContentTypes }) => ({
      body: await resolveBody(url),
      contentType: acceptedContentTypes[0] ?? "text/plain",
    }),
  };
}
