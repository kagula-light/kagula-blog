import { createHash } from "node:crypto";

import type { HotspotCandidateInput, HotspotSourceCode } from "@kagula/contracts/hotspots";

import type { SourceFetcher } from "../source-fetcher";

export interface HotspotAdapter {
  readonly sourceCode: HotspotSourceCode;
  readonly collect: (
    fetcher: SourceFetcher,
    capturedAt: Date,
  ) => Promise<readonly HotspotCandidateInput[]>;
}

export function createRawFingerprint(value: unknown): string {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  return createHash("sha256").update(serialized, "utf8").digest("hex");
}

export function sourceShapeChanged(sourceName: string, cause?: unknown): Error {
  return new Error(`${sourceName} response shape changed`, { cause });
}
