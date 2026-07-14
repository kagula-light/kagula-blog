import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

import { runMigrations } from "../src/migrate";

const databaseUrl = process.env.TEST_DATABASE_URL;
let client: ReturnType<typeof postgres> | undefined;

describe("interaction database constraints", () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  let authorId = "";
  let readerId = "";
  let moderatorId = "";
  let categoryId = "";
  let postId = "";
  let commentId = "";

  beforeAll(async () => {
    if (!databaseUrl)
      throw new Error("TEST_DATABASE_URL is required for database integration tests");
    await runMigrations({ databaseUrl });
    client = postgres(databaseUrl, { max: 1 });

    const [author] = await client<{ id: string }[]>`
      insert into users (username, normalized_username, display_name, role)
      values (${`ia_${suffix}`}, ${`ia_${suffix}`}, 'Interaction Author', 'ADMIN')
      returning id
    `;
    const [reader] = await client<{ id: string }[]>`
      insert into users (username, normalized_username, display_name, role)
      values (${`ir_${suffix}`}, ${`ir_${suffix}`}, 'Interaction Reader', 'USER')
      returning id
    `;
    const [moderator] = await client<{ id: string }[]>`
      insert into users (username, normalized_username, display_name, role)
      values (${`im_${suffix}`}, ${`im_${suffix}`}, 'Interaction Moderator', 'ADMIN')
      returning id
    `;
    const [category] = await client<{ id: string }[]>`
      insert into categories (name, slug) values ('Interaction Test', ${`interaction-${suffix}`}) returning id
    `;
    if (!author || !reader || !moderator || !category)
      throw new Error("interaction fixture failed");
    authorId = author.id;
    readerId = reader.id;
    moderatorId = moderator.id;
    categoryId = category.id;

    const [post] = await client<{ id: string }[]>`
      insert into posts (
        title, slug, excerpt, markdown, rendered_html, category_id, status,
        published_at, reading_minutes, created_by_user_id, updated_by_user_id
      ) values (
        'Interaction post', ${`interaction-post-${suffix}`}, 'Excerpt', '# Post', '<h1>Post</h1>',
        ${categoryId}, 'PUBLISHED', now(), 1, ${authorId}, ${authorId}
      ) returning id
    `;
    if (!post) throw new Error("interaction post fixture failed");
    postId = post.id;
  });

  afterAll(async () => {
    if (!client) return;
    if (postId) await client`delete from posts where id = ${postId}`;
    if (authorId) await client`delete from users where id = ${authorId}`;
    if (readerId) await client`delete from users where id = ${readerId}`;
    if (moderatorId) await client`delete from users where id = ${moderatorId}`;
    if (categoryId) await client`delete from categories where id = ${categoryId}`;
    await client.end({ timeout: 5 });
  });

  it("keeps repeated likes and favorites idempotent", async () => {
    if (!client) throw new Error("database client was not initialized");
    await client`insert into post_likes (post_id, user_id) values (${postId}, ${readerId}) on conflict do nothing`;
    await client`insert into post_likes (post_id, user_id) values (${postId}, ${readerId}) on conflict do nothing`;
    await client`insert into favorites (post_id, user_id) values (${postId}, ${readerId}) on conflict do nothing`;
    await client`insert into favorites (post_id, user_id) values (${postId}, ${readerId}) on conflict do nothing`;

    const [counts] = await client<{ likes: number; favorites: number }[]>`
      select
        (select count(*)::int from post_likes where post_id = ${postId} and user_id = ${readerId}) as likes,
        (select count(*)::int from favorites where post_id = ${postId} and user_id = ${readerId}) as favorites
    `;
    expect(counts).toEqual({ likes: 1, favorites: 1 });
  });

  it("stores moderation state and nulls a deleted moderator", async () => {
    if (!client) throw new Error("database client was not initialized");
    const [comment] = await client<{ id: string }[]>`
      insert into comments (post_id, author_user_id, body)
      values (${postId}, ${readerId}, 'Awaiting review') returning id
    `;
    if (!comment) throw new Error("comment fixture failed");
    commentId = comment.id;
    await client`
      update comments
      set status = 'APPROVED', moderated_by_user_id = ${moderatorId}, moderated_at = now()
      where id = ${commentId}
    `;
    await client`delete from users where id = ${moderatorId}`;
    const [saved] = await client<{ status: string; moderated_by_user_id: string | null }[]>`
      select status, moderated_by_user_id from comments where id = ${commentId}
    `;
    expect(saved).toEqual({ status: "APPROVED", moderated_by_user_id: null });
  });

  it("rejects empty or oversized comment bodies", async () => {
    if (!client) throw new Error("database client was not initialized");
    await expect(
      client`insert into comments (post_id, author_user_id, body) values (${postId}, ${readerId}, '   ')`,
    ).rejects.toThrow();
    await expect(
      client`insert into comments (post_id, author_user_id, body) values (${postId}, ${readerId}, ${"x".repeat(2001)})`,
    ).rejects.toThrow();
  });
});
