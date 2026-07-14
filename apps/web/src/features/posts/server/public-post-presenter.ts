import type { PublicPostSummary } from "./public-post-repository";

const publicDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function formatPublicDate(value: Date): string {
  return publicDateFormatter.format(value);
}

export function createPublicAssetUrl(baseUrl: string, objectKey: string): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const encodedKey = objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return new URL(encodedKey, normalizedBase).toString();
}

export function getPublicPostCoverUrl(
  post: Pick<PublicPostSummary, "cover">,
  publicAssetBaseUrl: string,
): string {
  return post.cover
    ? createPublicAssetUrl(publicAssetBaseUrl, post.cover.objectKey)
    : "/brand/default-cover.webp";
}

export interface AdjacentPosts {
  readonly newer: PublicPostSummary | null;
  readonly older: PublicPostSummary | null;
}

export function selectAdjacentPosts(
  posts: readonly PublicPostSummary[],
  currentPostId: string,
): AdjacentPosts {
  const index = posts.findIndex((post) => post.id === currentPostId);
  if (index === -1) return { newer: null, older: null };
  return {
    newer: posts[index - 1] ?? null,
    older: posts[index + 1] ?? null,
  };
}
