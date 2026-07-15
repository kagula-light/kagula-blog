import { randomUUID } from "node:crypto";

import { createDatabaseClient, type DatabaseClient } from "@kagura/database/client";
import { runMigrations } from "@kagura/database/migrate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCommentRepository } from "../src/features/comments/server/comment-repository";

const databaseUrl = process.env.TEST_DATABASE_URL;
let database: DatabaseClient | undefined;

function getDatabase(): DatabaseClient {
  if (!database) throw new Error("database client was not initialized");
  return database;
}

describe("comment repository", () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  let authorId = "";
  let activeId = "";
  let mutedId = "";
  let bannedId = "";
  let categoryId = "";
  let publishedId = "";
  let draftId = "";
  let commentId = "";

  beforeAll(async () => {
    if (!databaseUrl)
      throw new Error("TEST_DATABASE_URL is required for comment integration tests");
    await runMigrations({ databaseUrl });
    database = createDatabaseClient(databaseUrl);
    const userRows = await getDatabase().client<{ id: string; status: string }[]>`
      insert into users (username, normalized_username, display_name, role, status)
      values
        (${`comment_author_${suffix}`}, ${`comment_author_${suffix}`}, 'Comment Author', 'ADMIN', 'ACTIVE'),
        (${`comment_active_${suffix}`}, ${`comment_active_${suffix}`}, 'Comment Active', 'USER', 'ACTIVE'),
        (${`comment_muted_${suffix}`}, ${`comment_muted_${suffix}`}, 'Comment Muted', 'USER', 'MUTED'),
        (${`comment_banned_${suffix}`}, ${`comment_banned_${suffix}`}, 'Comment Banned', 'USER', 'BANNED')
      returning id, status
    `;
    authorId = userRows[0]?.id ?? "";
    activeId = userRows.find((row) => row.status === "ACTIVE" && row.id !== authorId)?.id ?? "";
    mutedId = userRows.find((row) => row.status === "MUTED")?.id ?? "";
    bannedId = userRows.find((row) => row.status === "BANNED")?.id ?? "";
    const [category] = await getDatabase().client<{ id: string }[]>`
      insert into categories (name, slug)
      values ('Comment Category', ${`comment-category-${suffix}`})
      returning id
    `;
    if (!authorId || !activeId || !mutedId || !bannedId || !category)
      throw new Error("comment fixture identities were not created");
    categoryId = category.id;
    const postRows = await getDatabase().client<{ id: string; status: string }[]>`
      insert into posts (
        title, slug, excerpt, markdown, rendered_html, category_id, status,
        published_at, reading_minutes, created_by_user_id, updated_by_user_id
      ) values
        ('Comment published', ${`comment-published-${suffix}`}, 'Published', '# Published', '<h1>Published</h1>', ${categoryId}, 'PUBLISHED', now(), 1, ${authorId}, ${authorId}),
        ('Comment draft', ${`comment-draft-${suffix}`}, 'Draft', '# Draft', '<h1>Draft</h1>', ${categoryId}, 'DRAFT', null, 1, ${authorId}, ${authorId})
      returning id, status
    `;
    publishedId = postRows.find((row) => row.status === "PUBLISHED")?.id ?? "";
    draftId = postRows.find((row) => row.status === "DRAFT")?.id ?? "";
    if (!publishedId || !draftId) throw new Error("comment fixture posts were not created");
  });

  afterAll(async () => {
    if (!database) return;
    await database.client`delete from comments where post_id in (${publishedId}, ${draftId})`;
    await database.client`delete from posts where id in (${publishedId}, ${draftId})`;
    await database.client`delete from categories where id = ${categoryId}`;
    await database.client`delete from users where id in (${authorId}, ${activeId}, ${mutedId}, ${bannedId})`;
    await database.close();
  });

  it("creates a PENDING comment for an active reader", async () => {
    const repository = createCommentRepository(getDatabase());
    const createdAt = new Date("2026-07-14T10:00:00.000Z");

    const result = await repository.createPendingComment({
      authorUserId: activeId,
      postId: publishedId,
      body: "等待审核",
      createdAt,
    });
    expect(result).toMatchObject({ status: "CREATED" });
    if (result.status !== "CREATED") throw new Error("pending comment was not created");
    commentId = result.id;
    const [saved] = await getDatabase().client<{ status: string; body: string }[]>`
      select status, body from comments where id = ${commentId}
    `;
    expect(saved).toEqual({ status: "PENDING", body: "等待审核" });
    await expect(repository.listApproved(publishedId)).resolves.toEqual([]);
  });

  it("rejects muted, banned, and unpublished comment creation", async () => {
    const repository = createCommentRepository(getDatabase());
    const input = {
      postId: publishedId,
      body: "blocked",
      createdAt: new Date("2026-07-14T10:00:00.000Z"),
    };

    await expect(
      repository.createPendingComment({ ...input, authorUserId: mutedId }),
    ).resolves.toEqual({ status: "FORBIDDEN" });
    await expect(
      repository.createPendingComment({ ...input, authorUserId: bannedId }),
    ).resolves.toEqual({ status: "FORBIDDEN" });
    await expect(
      repository.createPendingComment({ ...input, authorUserId: activeId, postId: draftId }),
    ).resolves.toEqual({ status: "POST_NOT_FOUND" });
  });

  it("lists only approved, non-deleted comments", async () => {
    const repository = createCommentRepository(getDatabase());
    await getDatabase().client`
      update comments set status = 'APPROVED', moderated_at = now() where id = ${commentId}
    `;
    await expect(repository.listApproved(publishedId)).resolves.toEqual([
      expect.objectContaining({
        id: commentId,
        body: "等待审核",
        authorDisplayName: "Comment Active",
      }),
    ]);

    await getDatabase().client`update comments set status = 'REJECTED' where id = ${commentId}`;
    await expect(repository.listApproved(publishedId)).resolves.toEqual([]);
    await getDatabase().client`
      update comments set status = 'APPROVED', deleted_at = now() where id = ${commentId}
    `;
    await expect(repository.listApproved(publishedId)).resolves.toEqual([]);
  });
});
