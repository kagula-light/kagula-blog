import type { DatabaseClient } from "@kagura/database/client";
import {
  auditLogs,
  categories,
  mediaAssets,
  posts,
  postRevisions,
  postSlugRedirects,
  postTags,
  tags,
} from "@kagura/database/schema";
import { and, desc, eq, inArray } from "drizzle-orm";

import type {
  CreatePostPersistenceInput,
  ManagedPost,
  PreparedPostContent,
  UpdatePostPersistenceInput,
} from "./post-service";

type ContentReferenceReader = Pick<DatabaseClient["db"], "select">;

async function validateContentReferences(
  database: ContentReferenceReader,
  content: PreparedPostContent,
  actorId: string,
): Promise<void> {
  const [category] = await database
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, content.categoryId))
    .limit(1);
  if (!category) throw new Error("Post category does not exist");

  if (content.tagIds.length > 0) {
    const existingTags = await database
      .select({ id: tags.id })
      .from(tags)
      .where(inArray(tags.id, [...content.tagIds]));
    if (existingTags.length !== content.tagIds.length) {
      throw new Error("One or more post tags do not exist");
    }
  }

  const mediaIds = [content.coverMediaId, content.socialMediaId].filter(
    (mediaId): mediaId is string => mediaId !== null,
  );
  if (mediaIds.length > 0) {
    const readyMedia = await database
      .select({ id: mediaAssets.id })
      .from(mediaAssets)
      .where(
        and(
          inArray(mediaAssets.id, mediaIds),
          eq(mediaAssets.ownerUserId, actorId),
          eq(mediaAssets.status, "READY"),
        ),
      );
    if (readyMedia.length !== mediaIds.length) {
      throw new Error("Referenced media must be owned by the administrator and ready");
    }
  }
}

function revisionValues(
  postId: string,
  input: CreatePostPersistenceInput | UpdatePostPersistenceInput,
) {
  return {
    postId,
    revisionNumber: input.revisionNumber,
    title: input.content.title,
    slug: input.content.slug,
    excerpt: input.content.excerpt,
    markdown: input.content.markdown,
    renderedHtml: input.content.renderedHtml,
    aiSummary: input.content.aiSummary,
    summarySource: input.content.summarySource,
    coverMediaId: input.content.coverMediaId,
    categoryId: input.content.categoryId,
    status: input.lifecycle.status,
    scheduledFor: input.lifecycle.scheduledFor,
    publishedAt: input.lifecycle.publishedAt,
    archivedAt: input.lifecycle.archivedAt,
    readingMinutes: input.content.readingMinutes,
    seoTitle: input.content.seoTitle,
    seoDescription: input.content.seoDescription,
    socialMediaId: input.content.socialMediaId,
    editorUserId: input.actorId,
    createdAt: input.occurredAt,
  } as const;
}

const managedPostSelection = {
  id: posts.id,
  slug: posts.slug,
  status: posts.status,
  version: posts.version,
  scheduledFor: posts.scheduledFor,
  publishedAt: posts.publishedAt,
  archivedAt: posts.archivedAt,
} as const;

export interface PostRepository {
  readonly findPost: (postId: string) => Promise<ManagedPost | null>;
  readonly findPostEditor: (postId: string) => Promise<PostEditorData | null>;
  readonly listPosts: (limit?: number) => Promise<readonly PostListItem[]>;
  readonly listCategories: () => Promise<readonly TaxonomyItem[]>;
  readonly listTags: () => Promise<readonly TaxonomyItem[]>;
  readonly createPost: (input: CreatePostPersistenceInput) => Promise<ManagedPost>;
  readonly updatePost: (input: UpdatePostPersistenceInput) => Promise<ManagedPost>;
}

export interface TaxonomyItem {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

export interface PostListItem extends ManagedPost {
  readonly title: string;
  readonly excerpt: string;
  readonly updatedAt: Date;
}

export interface PostEditorData extends PostListItem {
  readonly markdown: string;
  readonly renderedHtml: string;
  readonly aiSummary: string | null;
  readonly categoryId: string;
  readonly tagIds: readonly string[];
  readonly coverMediaId: string | null;
  readonly seoTitle: string | null;
  readonly seoDescription: string | null;
  readonly socialMediaId: string | null;
}

export function createPostRepository(database: DatabaseClient): PostRepository {
  return {
    findPost: async (postId) => {
      const [post] = await database.db
        .select(managedPostSelection)
        .from(posts)
        .where(eq(posts.id, postId))
        .limit(1);
      return post ?? null;
    },

    findPostEditor: async (postId) => {
      const [post] = await database.db
        .select({
          ...managedPostSelection,
          title: posts.title,
          excerpt: posts.excerpt,
          updatedAt: posts.updatedAt,
          markdown: posts.markdown,
          renderedHtml: posts.renderedHtml,
          aiSummary: posts.aiSummary,
          categoryId: posts.categoryId,
          coverMediaId: posts.coverMediaId,
          seoTitle: posts.seoTitle,
          seoDescription: posts.seoDescription,
          socialMediaId: posts.socialMediaId,
        })
        .from(posts)
        .where(eq(posts.id, postId))
        .limit(1);
      if (!post) return null;
      const postTagRows = await database.db
        .select({ tagId: postTags.tagId })
        .from(postTags)
        .where(eq(postTags.postId, postId));
      return { ...post, tagIds: postTagRows.map((row) => row.tagId) };
    },

    listPosts: async (limit = 100) =>
      database.db
        .select({
          ...managedPostSelection,
          title: posts.title,
          excerpt: posts.excerpt,
          updatedAt: posts.updatedAt,
        })
        .from(posts)
        .orderBy(desc(posts.updatedAt))
        .limit(Math.min(Math.max(limit, 1), 200)),

    listCategories: async () =>
      database.db
        .select({ id: categories.id, name: categories.name, slug: categories.slug })
        .from(categories)
        .orderBy(categories.name),

    listTags: async () =>
      database.db
        .select({ id: tags.id, name: tags.name, slug: tags.slug })
        .from(tags)
        .orderBy(tags.name),

    createPost: async (input) =>
      database.db.transaction(async (transaction) => {
        await validateContentReferences(transaction, input.content, input.actorId);
        const [post] = await transaction
          .insert(posts)
          .values({
            title: input.content.title,
            slug: input.content.slug,
            excerpt: input.content.excerpt,
            markdown: input.content.markdown,
            renderedHtml: input.content.renderedHtml,
            aiSummary: input.content.aiSummary,
            summarySource: input.content.summarySource,
            coverMediaId: input.content.coverMediaId,
            categoryId: input.content.categoryId,
            status: input.lifecycle.status,
            scheduledFor: input.lifecycle.scheduledFor,
            publishedAt: input.lifecycle.publishedAt,
            archivedAt: input.lifecycle.archivedAt,
            readingMinutes: input.content.readingMinutes,
            seoTitle: input.content.seoTitle,
            seoDescription: input.content.seoDescription,
            socialMediaId: input.content.socialMediaId,
            createdByUserId: input.actorId,
            updatedByUserId: input.actorId,
            version: input.revisionNumber,
            createdAt: input.occurredAt,
            updatedAt: input.occurredAt,
          })
          .returning(managedPostSelection);
        if (!post) throw new Error("Post creation did not return a row");

        if (input.content.tagIds.length > 0) {
          await transaction.insert(postTags).values(
            input.content.tagIds.map((tagId) => ({
              postId: post.id,
              tagId,
            })),
          );
        }
        await transaction.insert(postRevisions).values(revisionValues(post.id, input));
        await transaction.insert(auditLogs).values({
          actorUserId: input.actorId,
          action: input.auditAction,
          resourceType: "POST",
          resourceId: post.id,
          summary: { status: post.status, revisionNumber: input.revisionNumber },
          createdAt: input.occurredAt,
        });
        return post;
      }),

    updatePost: async (input) =>
      database.db.transaction(async (transaction) => {
        await validateContentReferences(transaction, input.content, input.actorId);

        if (input.previousSlug !== input.content.slug) {
          const [targetRedirect] = await transaction
            .select({ postId: postSlugRedirects.postId })
            .from(postSlugRedirects)
            .where(eq(postSlugRedirects.oldSlug, input.content.slug))
            .limit(1);
          if (targetRedirect && targetRedirect.postId !== input.postId) {
            throw new Error("Post slug is reserved by another post redirect");
          }
          if (targetRedirect) {
            await transaction
              .delete(postSlugRedirects)
              .where(
                and(
                  eq(postSlugRedirects.oldSlug, input.content.slug),
                  eq(postSlugRedirects.postId, input.postId),
                ),
              );
          }
        }

        const [post] = await transaction
          .update(posts)
          .set({
            title: input.content.title,
            slug: input.content.slug,
            excerpt: input.content.excerpt,
            markdown: input.content.markdown,
            renderedHtml: input.content.renderedHtml,
            aiSummary: input.content.aiSummary,
            summarySource: input.content.summarySource,
            coverMediaId: input.content.coverMediaId,
            categoryId: input.content.categoryId,
            status: input.lifecycle.status,
            scheduledFor: input.lifecycle.scheduledFor,
            publishedAt: input.lifecycle.publishedAt,
            archivedAt: input.lifecycle.archivedAt,
            readingMinutes: input.content.readingMinutes,
            seoTitle: input.content.seoTitle,
            seoDescription: input.content.seoDescription,
            socialMediaId: input.content.socialMediaId,
            updatedByUserId: input.actorId,
            version: input.revisionNumber,
            updatedAt: input.occurredAt,
          })
          .where(and(eq(posts.id, input.postId), eq(posts.version, input.expectedVersion)))
          .returning(managedPostSelection);
        if (!post) throw new Error("Post version conflict; reload before saving");

        if (input.previousSlug !== input.content.slug) {
          const [existingRedirect] = await transaction
            .select({ postId: postSlugRedirects.postId })
            .from(postSlugRedirects)
            .where(eq(postSlugRedirects.oldSlug, input.previousSlug))
            .limit(1);
          if (existingRedirect && existingRedirect.postId !== input.postId) {
            throw new Error("Previous post slug is reserved by another post");
          }
          if (!existingRedirect) {
            await transaction.insert(postSlugRedirects).values({
              postId: input.postId,
              oldSlug: input.previousSlug,
              createdAt: input.occurredAt,
            });
          }
        }

        await transaction.delete(postTags).where(eq(postTags.postId, input.postId));
        if (input.content.tagIds.length > 0) {
          await transaction.insert(postTags).values(
            input.content.tagIds.map((tagId) => ({
              postId: input.postId,
              tagId,
            })),
          );
        }
        await transaction.insert(postRevisions).values(revisionValues(input.postId, input));
        await transaction.insert(auditLogs).values({
          actorUserId: input.actorId,
          action: input.auditAction,
          resourceType: "POST",
          resourceId: input.postId,
          summary: { status: post.status, revisionNumber: input.revisionNumber },
          createdAt: input.occurredAt,
        });
        return post;
      }),
  };
}
