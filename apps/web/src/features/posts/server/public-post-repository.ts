import type { DatabaseClient } from "@kagura/database/client";
import {
  categories,
  mediaAssets,
  posts,
  postSlugRedirects,
  postTags,
  tags,
} from "@kagura/database/schema";
import { and, desc, eq, ilike, inArray, isNotNull, or } from "drizzle-orm";

export interface PublicTaxonomy {
  readonly name: string;
  readonly slug: string;
}

export interface PublicPostCover {
  readonly objectKey: string;
  readonly altText: string | null;
  readonly width: number;
  readonly height: number;
}

export interface PublicPostSummary {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly excerpt: string;
  readonly aiSummary: string | null;
  readonly readingMinutes: number;
  readonly publishedAt: Date;
  readonly updatedAt: Date;
  readonly category: PublicTaxonomy;
  readonly tags: readonly PublicTaxonomy[];
  readonly cover: PublicPostCover | null;
}

export interface PublicPostDetail extends PublicPostSummary {
  readonly renderedHtml: string;
  readonly seoTitle: string | null;
  readonly seoDescription: string | null;
}

export interface PublicArchiveGroup {
  readonly key: string;
  readonly label: string;
  readonly posts: readonly PublicPostSummary[];
}

export type PublicPostResolution =
  | { readonly kind: "POST"; readonly post: PublicPostDetail }
  | { readonly kind: "REDIRECT"; readonly slug: string }
  | { readonly kind: "NOT_FOUND" };

interface PublicPostRow {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly excerpt: string;
  readonly aiSummary: string | null;
  readonly readingMinutes: number;
  readonly publishedAt: Date | null;
  readonly updatedAt: Date;
  readonly categoryName: string;
  readonly categorySlug: string;
  readonly coverObjectKey: string | null;
  readonly coverAltText: string | null;
  readonly coverWidth: number | null;
  readonly coverHeight: number | null;
}

const publicPostSelection = {
  id: posts.id,
  title: posts.title,
  slug: posts.slug,
  excerpt: posts.excerpt,
  aiSummary: posts.aiSummary,
  readingMinutes: posts.readingMinutes,
  publishedAt: posts.publishedAt,
  updatedAt: posts.updatedAt,
  categoryName: categories.name,
  categorySlug: categories.slug,
  coverObjectKey: mediaAssets.objectKey,
  coverAltText: mediaAssets.altText,
  coverWidth: mediaAssets.width,
  coverHeight: mediaAssets.height,
} as const;

const publishedCondition = and(eq(posts.status, "PUBLISHED"), isNotNull(posts.publishedAt));

export function normalizePublicSearchQuery(value: string): string | null {
  const normalized = value.normalize("NFKC").trim();
  if (!normalized) return null;
  if (normalized.length > 100) throw new Error("Public search query exceeds 100 characters");
  return normalized;
}

export function groupPublishedPostsByMonth(
  publishedPosts: readonly PublicPostSummary[],
): readonly PublicArchiveGroup[] {
  const groups = new Map<string, PublicPostSummary[]>();
  for (const post of publishedPosts) {
    const year = post.publishedAt.getUTCFullYear();
    const month = post.publishedAt.getUTCMonth() + 1;
    const key = `${year}-${month.toString().padStart(2, "0")}`;
    const existing = groups.get(key) ?? [];
    existing.push(post);
    groups.set(key, existing);
  }
  return [...groups].map(([key, groupedPosts]) => {
    const [year, month] = key.split("-");
    return { key, label: `${year} 年 ${Number(month)} 月`, posts: groupedPosts };
  });
}

export interface PublicPostRepository {
  readonly listPublished: (limit?: number) => Promise<readonly PublicPostSummary[]>;
  readonly listByCategory: (
    categorySlug: string,
    limit?: number,
  ) => Promise<readonly PublicPostSummary[]>;
  readonly listByTag: (tagSlug: string, limit?: number) => Promise<readonly PublicPostSummary[]>;
  readonly search: (query: string, limit?: number) => Promise<readonly PublicPostSummary[]>;
  readonly resolveSlug: (slug: string) => Promise<PublicPostResolution>;
}

export function createPublicPostRepository(database: DatabaseClient): PublicPostRepository {
  async function loadTags(postIds: readonly string[]) {
    const grouped = new Map<string, PublicTaxonomy[]>();
    if (postIds.length === 0) return grouped;
    const rows = await database.db
      .select({ postId: postTags.postId, name: tags.name, slug: tags.slug })
      .from(postTags)
      .innerJoin(tags, eq(tags.id, postTags.tagId))
      .where(inArray(postTags.postId, [...postIds]));
    for (const row of rows) {
      const values = grouped.get(row.postId) ?? [];
      values.push({ name: row.name, slug: row.slug });
      grouped.set(row.postId, values);
    }
    return grouped;
  }

  async function mapRows(rows: readonly PublicPostRow[]): Promise<readonly PublicPostSummary[]> {
    const tagGroups = await loadTags(rows.map((row) => row.id));
    return rows.flatMap((row) => {
      if (!row.publishedAt) return [];
      const cover =
        row.coverObjectKey && row.coverWidth && row.coverHeight
          ? {
              objectKey: row.coverObjectKey,
              altText: row.coverAltText,
              width: row.coverWidth,
              height: row.coverHeight,
            }
          : null;
      return [
        {
          id: row.id,
          title: row.title,
          slug: row.slug,
          excerpt: row.excerpt,
          aiSummary: row.aiSummary,
          readingMinutes: row.readingMinutes,
          publishedAt: row.publishedAt,
          updatedAt: row.updatedAt,
          category: { name: row.categoryName, slug: row.categorySlug },
          tags: tagGroups.get(row.id) ?? [],
          cover,
        },
      ];
    });
  }

  function baseQuery() {
    return database.db
      .select(publicPostSelection)
      .from(posts)
      .innerJoin(categories, eq(categories.id, posts.categoryId))
      .leftJoin(
        mediaAssets,
        and(eq(mediaAssets.id, posts.coverMediaId), eq(mediaAssets.status, "READY")),
      );
  }

  async function findDetailByCurrentSlug(slug: string): Promise<PublicPostDetail | null> {
    const [row] = await database.db
      .select({
        ...publicPostSelection,
        renderedHtml: posts.renderedHtml,
        seoTitle: posts.seoTitle,
        seoDescription: posts.seoDescription,
      })
      .from(posts)
      .innerJoin(categories, eq(categories.id, posts.categoryId))
      .leftJoin(
        mediaAssets,
        and(eq(mediaAssets.id, posts.coverMediaId), eq(mediaAssets.status, "READY")),
      )
      .where(and(publishedCondition, eq(posts.slug, slug)))
      .limit(1);
    if (!row) return null;
    const [summary] = await mapRows([row]);
    return summary
      ? {
          ...summary,
          renderedHtml: row.renderedHtml,
          seoTitle: row.seoTitle,
          seoDescription: row.seoDescription,
        }
      : null;
  }

  return {
    listPublished: async (limit = 30) => {
      const rows = await baseQuery()
        .where(publishedCondition)
        .orderBy(desc(posts.publishedAt))
        .limit(Math.min(Math.max(limit, 1), 100));
      return mapRows(rows);
    },

    listByCategory: async (categorySlug, limit = 50) => {
      const rows = await baseQuery()
        .where(and(publishedCondition, eq(categories.slug, categorySlug)))
        .orderBy(desc(posts.publishedAt))
        .limit(Math.min(Math.max(limit, 1), 100));
      return mapRows(rows);
    },

    listByTag: async (tagSlug, limit = 50) => {
      const rows = await database.db
        .select(publicPostSelection)
        .from(posts)
        .innerJoin(categories, eq(categories.id, posts.categoryId))
        .innerJoin(postTags, eq(postTags.postId, posts.id))
        .innerJoin(tags, eq(tags.id, postTags.tagId))
        .leftJoin(
          mediaAssets,
          and(eq(mediaAssets.id, posts.coverMediaId), eq(mediaAssets.status, "READY")),
        )
        .where(and(publishedCondition, eq(tags.slug, tagSlug)))
        .orderBy(desc(posts.publishedAt))
        .limit(Math.min(Math.max(limit, 1), 100));
      return mapRows(rows);
    },

    search: async (query, limit = 30) => {
      const normalized = normalizePublicSearchQuery(query);
      if (!normalized) return [];
      const escaped = normalized.replace(/[\\%_]/g, "\\$&");
      const pattern = `%${escaped}%`;
      const rows = await baseQuery()
        .where(
          and(
            publishedCondition,
            or(
              ilike(posts.title, pattern),
              ilike(posts.excerpt, pattern),
              ilike(posts.markdown, pattern),
            ),
          ),
        )
        .orderBy(desc(posts.publishedAt))
        .limit(Math.min(Math.max(limit, 1), 100));
      return mapRows(rows);
    },

    resolveSlug: async (slug) => {
      const current = await findDetailByCurrentSlug(slug);
      if (current) return { kind: "POST", post: current };
      const [redirect] = await database.db
        .select({ currentSlug: posts.slug })
        .from(postSlugRedirects)
        .innerJoin(posts, eq(posts.id, postSlugRedirects.postId))
        .where(
          and(
            eq(postSlugRedirects.oldSlug, slug),
            eq(posts.status, "PUBLISHED"),
            isNotNull(posts.publishedAt),
          ),
        )
        .limit(1);
      return redirect ? { kind: "REDIRECT", slug: redirect.currentSlug } : { kind: "NOT_FOUND" };
    },
  };
}
