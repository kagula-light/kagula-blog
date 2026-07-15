import { createHash } from "node:crypto";

export const HOTSPOT_SOURCE_CODES = [
  "GITHUB_TRENDING",
  "HACKER_NEWS",
  "BILIBILI",
  "WEIBO",
  "BAIDU",
] as const;

export type HotspotSourceCode = (typeof HOTSPOT_SOURCE_CODES)[number];

export interface HotspotCandidateInput {
  readonly sourceCode: HotspotSourceCode;
  readonly externalId?: string | null;
  readonly title: string;
  readonly url: string;
  readonly rank: number;
  readonly score?: number;
  readonly category?: string;
  readonly capturedAt: Date;
  readonly rawFingerprint: string;
}

export interface HotspotNormalizationPolicy {
  readonly allowedHosts: readonly string[];
}

export interface HotspotFingerprintInput {
  readonly sourceCode: HotspotSourceCode;
  readonly externalId: string | null;
  readonly normalizedUrl: string;
  readonly title: string;
}

export interface NormalizedHotspotCandidate {
  readonly sourceCode: HotspotSourceCode;
  readonly externalId: string | null;
  readonly title: string;
  readonly url: string;
  readonly normalizedUrl: string;
  readonly rank: number;
  readonly score?: number;
  readonly category?: string;
  readonly capturedAt: Date;
  readonly rawFingerprint: string;
  readonly dedupeKey: string;
}

const invisibleCharacters = /[\u200B-\u200F\u2060\uFEFF]/gu;
const dangerousControlCharacters = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u;
const trackingParameters = new Set(["fbclid", "from", "gclid", "ref", "source", "spm_id_from"]);

function normalizeText(value: string, field: string, maximumLength: number): string {
  const normalized = value.normalize("NFKC").replace(invisibleCharacters, "").trim();
  if (dangerousControlCharacters.test(normalized)) {
    throw new Error(`${field} contains unsafe control characters`);
  }
  const collapsed = normalized.replace(/\s+/gu, " ");
  if (collapsed.length === 0 || [...collapsed].length > maximumLength) {
    throw new Error(`${field} length is invalid`);
  }
  return collapsed;
}

function normalizeExternalId(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return normalizeText(value, "externalId", 256);
}

function normalizeUrl(value: string, policy: HotspotNormalizationPolicy): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("hotspot URL is invalid");
  }
  if (url.protocol !== "https:") throw new Error("hotspot URL must use HTTPS");
  if (url.username || url.password) throw new Error("hotspot URL must not contain credentials");
  if (url.port && url.port !== "443") throw new Error("hotspot URL port is not allowed");

  const allowedHosts = new Set(policy.allowedHosts.map((host) => host.toLowerCase()));
  if (!allowedHosts.has(url.hostname.toLowerCase())) {
    throw new Error("hotspot URL host is outside the allowlist");
  }

  for (const name of [...url.searchParams.keys()]) {
    const normalizedName = name.toLowerCase();
    if (
      normalizedName.startsWith("utm_") ||
      normalizedName.startsWith("spm_") ||
      trackingParameters.has(normalizedName)
    ) {
      url.searchParams.delete(name);
    }
  }
  url.searchParams.sort();
  url.hash = "";
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/u, "");
  return url.toString();
}

export function createHotspotFingerprint(input: HotspotFingerprintInput): string {
  const identity = input.externalId
    ? `${input.sourceCode}\0${input.externalId}`
    : `${input.sourceCode}\0${input.normalizedUrl}\0${input.title}`;
  return createHash("sha256").update(identity, "utf8").digest("hex");
}

export function normalizeHotspotCandidate(
  input: HotspotCandidateInput,
  policy: HotspotNormalizationPolicy,
): NormalizedHotspotCandidate {
  if (!Number.isInteger(input.rank) || input.rank < 1 || input.rank > 1_000) {
    throw new Error("hotspot rank must be an integer from 1 to 1000");
  }
  if (
    input.score !== undefined &&
    (!Number.isSafeInteger(input.score) || input.score < 0 || input.score > 2_147_483_647)
  ) {
    throw new Error("hotspot score must be a non-negative integer");
  }
  if (!Number.isFinite(input.capturedAt.getTime())) {
    throw new Error("hotspot capturedAt is invalid");
  }

  const title = normalizeText(input.title, "title", 180);
  const externalId = normalizeExternalId(input.externalId);
  const normalizedUrl = normalizeUrl(input.url, policy);
  const rawFingerprint = normalizeText(input.rawFingerprint, "rawFingerprint", 128);
  const category =
    input.category === undefined ? undefined : normalizeText(input.category, "category", 80);
  const dedupeKey = createHotspotFingerprint({
    sourceCode: input.sourceCode,
    externalId,
    normalizedUrl,
    title,
  });

  return {
    sourceCode: input.sourceCode,
    externalId,
    title,
    url: normalizedUrl,
    normalizedUrl,
    rank: input.rank,
    ...(input.score === undefined ? {} : { score: input.score }),
    ...(category === undefined ? {} : { category }),
    capturedAt: new Date(input.capturedAt),
    rawFingerprint,
    dedupeKey,
  };
}
