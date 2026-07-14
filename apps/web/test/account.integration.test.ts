import { randomUUID } from "node:crypto";

import { createDatabaseClient, type DatabaseClient } from "@kagura/database/client";
import { runMigrations } from "@kagura/database/migrate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createAccountRepository } from "../src/features/account/server/account-repository";

const databaseUrl = process.env.TEST_DATABASE_URL;
let database: DatabaseClient | undefined;

function getDatabase(): DatabaseClient {
  if (!database) throw new Error("database client was not initialized");
  return database;
}

describe("account activity", () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  let authorId = "";
  let userId = "";
  let categoryId = "";
  let postId = "";

  beforeAll(async () => {
    if (!databaseUrl)
      throw new Error("TEST_DATABASE_URL is required for account integration tests");
    await runMigrations({ databaseUrl });
    database = createDatabaseClient(databaseUrl);
    const [author] = await getDatabase().client<{ id: string }[]>`
      insert into users (username, normalized_username, display_name, role)
      values (${`account_author_${suffix}`}, ${`account_author_${suffix}`}, 'Account Author', 'ADMIN')
      returning id
    `;
    const [reader] = await getDatabase().client<{ id: string }[]>`
      insert into users (username, normalized_username, display_name, role)
      values (${`account_reader_${suffix}`}, ${`account_reader_${suffix}`}, 'Account Reader', 'USER')
      returning id
    `;
    const [category] = await getDatabase().client<{ id: string }[]>`
      insert into categories (name, slug)
      values ('Account Category', ${`account-category-${suffix}`})
      returning id
    `;
    if (!author || !reader || !category)
      throw new Error("account fixture identities were not created");
    authorId = author.id;
    userId = reader.id;
    categoryId = category.id;
    const [post] = await getDatabase().client<{ id: string }[]>`
      insert into posts (
        title, slug, excerpt, markdown, rendered_html, category_id, status,
        published_at, reading_minutes, created_by_user_id, updated_by_user_id
      ) values (
        'Account constellation', ${`account-post-${suffix}`}, 'Account excerpt',
        '# Account', '<h1>Account</h1>', ${categoryId}, 'PUBLISHED',
        now(), 1, ${authorId}, ${authorId}
      )
      returning id
    `;
    if (!post) throw new Error("account fixture post was not created");
    postId = post.id;
    await getDatabase()
      .client`insert into favorites (post_id, user_id) values (${postId}, ${userId})`;
    await getDatabase().client`
      insert into comments (post_id, author_user_id, body, status)
      values (${postId}, ${userId}, '等待审核的评论', 'PENDING')
    `;
  });

  afterAll(async () => {
    if (!database) return;
    await database.client`delete from comments where author_user_id = ${userId}`;
    await database.client`delete from favorites where user_id = ${userId}`;
    await database.client`delete from posts where id = ${postId}`;
    await database.client`delete from categories where id = ${categoryId}`;
    await database.client`delete from users where id in (${userId}, ${authorId})`;
    await database.close();
  });

  it("lists the reader's favorites and submitted comments with current states", async () => {
    const repository = createAccountRepository(getDatabase());

    await expect(repository.getActivity(userId)).resolves.toEqual({
      favorites: [
        expect.objectContaining({
          postId,
          title: "Account constellation",
          slug: `account-post-${suffix}`,
          postStatus: "PUBLISHED",
        }),
      ],
      comments: [
        expect.objectContaining({
          postId,
          postTitle: "Account constellation",
          postSlug: `account-post-${suffix}`,
          body: "等待审核的评论",
          status: "PENDING",
        }),
      ],
    });
  });
});
