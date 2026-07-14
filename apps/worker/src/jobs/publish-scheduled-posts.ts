import type { DatabaseClient } from "@kagura/database/client";
import { auditLogs, posts, postRevisions } from "@kagura/database/schema";
import { and, asc, eq, isNotNull, lte } from "drizzle-orm";

export interface ScheduledPostPublisher {
  readonly publishDuePosts: (now: Date) => Promise<number>;
}

export function publishScheduledPosts(
  publisher: ScheduledPostPublisher,
  now: Date = new Date(),
): Promise<number> {
  return publisher.publishDuePosts(now);
}

export function createScheduledPostPublisher(database: DatabaseClient): ScheduledPostPublisher {
  return {
    publishDuePosts: async (now) =>
      database.db.transaction(async (transaction) => {
        const duePosts = await transaction
          .select({
            id: posts.id,
            title: posts.title,
            slug: posts.slug,
            excerpt: posts.excerpt,
            markdown: posts.markdown,
            renderedHtml: posts.renderedHtml,
            aiSummary: posts.aiSummary,
            summarySource: posts.summarySource,
            coverMediaId: posts.coverMediaId,
            categoryId: posts.categoryId,
            scheduledFor: posts.scheduledFor,
            readingMinutes: posts.readingMinutes,
            seoTitle: posts.seoTitle,
            seoDescription: posts.seoDescription,
            socialMediaId: posts.socialMediaId,
            updatedByUserId: posts.updatedByUserId,
            version: posts.version,
          })
          .from(posts)
          .where(
            and(
              eq(posts.status, "SCHEDULED"),
              isNotNull(posts.scheduledFor),
              lte(posts.scheduledFor, now),
            ),
          )
          .orderBy(asc(posts.scheduledFor))
          .limit(20)
          .for("update");

        let publishedCount = 0;
        for (const post of duePosts) {
          const [published] = await transaction
            .update(posts)
            .set({
              status: "PUBLISHED",
              scheduledFor: null,
              publishedAt: now,
              archivedAt: null,
              version: post.version + 1,
              updatedByUserId: post.updatedByUserId,
              updatedAt: now,
            })
            .where(
              and(
                eq(posts.id, post.id),
                eq(posts.status, "SCHEDULED"),
                isNotNull(posts.scheduledFor),
                lte(posts.scheduledFor, now),
              ),
            )
            .returning({ id: posts.id, version: posts.version });
          if (!published) continue;

          await transaction.insert(postRevisions).values({
            postId: post.id,
            revisionNumber: published.version,
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
            markdown: post.markdown,
            renderedHtml: post.renderedHtml,
            aiSummary: post.aiSummary,
            summarySource: post.summarySource,
            coverMediaId: post.coverMediaId,
            categoryId: post.categoryId,
            status: "PUBLISHED",
            scheduledFor: null,
            publishedAt: now,
            archivedAt: null,
            readingMinutes: post.readingMinutes,
            seoTitle: post.seoTitle,
            seoDescription: post.seoDescription,
            socialMediaId: post.socialMediaId,
            editorUserId: post.updatedByUserId,
            createdAt: now,
          });
          await transaction.insert(auditLogs).values({
            actorUserId: null,
            action: "POST_SCHEDULED_PUBLISHED",
            resourceType: "POST",
            resourceId: post.id,
            summary: { revisionNumber: published.version },
            createdAt: now,
          });
          publishedCount += 1;
        }
        return publishedCount;
      }),
  };
}
