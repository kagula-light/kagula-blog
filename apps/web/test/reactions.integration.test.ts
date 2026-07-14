import { randomUUID } from "node:crypto";

import { createDatabaseClient, type DatabaseClient } from "@kagura/database/client";
import { runMigrations } from "@kagura/database/migrate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createReactionRepository } from "../src/features/reactions/server/reaction-repository";

const databaseUrl = process.env.TEST_DATABASE_URL;
let database: DatabaseClient | undefined;

function getDatabase(): DatabaseClient {
  if (!database) throw new Error("database client was not initialized");
  return database;
}

describe("reaction repository", () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  let authorId = "";
  let activeId = "";
  let mutedId = "";
  let bannedId = "";
  let categoryId = "";
  let publishedId = "";
  let draftId = "";

  beforeAll(async () => {
    if (!databaseUrl)
      throw new Error("TEST_DATABASE_URL is required for reaction integration tests");
    await runMigrations({ databaseUrl });
    database = createDatabaseClient(databaseUrl);
    const userRows = await getDatabase().client<{ id: string; status: string }[]>`
      insert into users (username, normalized_username, display_name, role, status)
      values
        (${`reaction_author_${suffix}`}, ${`reaction_author_${suffix}`}, 'Reaction Author', 'ADMIN', 'ACTIVE'),
        (${`reaction_active_${suffix}`}, ${`reaction_active_${suffix}`}, 'Reaction Active', 'USER', 'ACTIVE'),
        (${`reaction_muted_${suffix}`}, ${`reaction_muted_${suffix}`}, 'Reaction Muted', 'USER', 'MUTED'),
        (${`reaction_banned_${suffix}`}, ${`reaction_banned_${suffix}`}, 'Reaction Banned', 'USER', 'BANNED')
      returning id, status
    `;
    authorId = userRows[0]?.id ?? "";
    activeId = userRows.find((row) => row.status === "ACTIVE" && row.id !== authorId)?.id ?? "";
    mutedId = userRows.find((row) => row.status === "MUTED")?.id ?? "";
    bannedId = userRows.find((row) => row.status === "BANNED")?.id ?? "";
    const [category] = await getDatabase().client<{ id: string }[]>`
      insert into categories (name, slug)
      values ('Reaction Category', ${`reaction-category-${suffix}`})
      returning id
    `;
    if (!authorId || !activeId || !mutedId || !bannedId || !category)
      throw new Error("reaction fixture identities were not created");
    categoryId = category.id;
    const postRows = await getDatabase().client<{ id: string; status: string }[]>`
      insert into posts (
        title, slug, excerpt, markdown, rendered_html, category_id, status,
        published_at, reading_minutes, created_by_user_id, updated_by_user_id
      ) values
        ('Reaction published', ${`reaction-published-${suffix}`}, 'Published', '# Published', '<h1>Published</h1>', ${categoryId}, 'PUBLISHED', now(), 1, ${authorId}, ${authorId}),
        ('Reaction draft', ${`reaction-draft-${suffix}`}, 'Draft', '# Draft', '<h1>Draft</h1>', ${categoryId}, 'DRAFT', null, 1, ${authorId}, ${authorId})
      returning id, status
    `;
    publishedId = postRows.find((row) => row.status === "PUBLISHED")?.id ?? "";
    draftId = postRows.find((row) => row.status === "DRAFT")?.id ?? "";
    if (!publishedId || !draftId) throw new Error("reaction fixture posts were not created");
  });

  afterAll(async () => {
    if (!database) return;
    await database.client`delete from posts where id in (${publishedId}, ${draftId})`;
    await database.client`delete from categories where id = ${categoryId}`;
    await database.client`delete from users where id in (${authorId}, ${activeId}, ${mutedId}, ${bannedId})`;
    await database.close();
  });

  it("keeps repeated like and unlike commands idempotent", async () => {
    const repository = createReactionRepository(getDatabase());
    const add = { userId: activeId, postId: publishedId, kind: "LIKE", active: true } as const;
    const remove = { ...add, active: false } as const;

    await expect(repository.mutateReaction(add)).resolves.toEqual({
      status: "SUCCESS",
      active: true,
      count: 1,
    });
    await expect(repository.mutateReaction(add)).resolves.toEqual({
      status: "SUCCESS",
      active: true,
      count: 1,
    });
    await expect(repository.mutateReaction(remove)).resolves.toEqual({
      status: "SUCCESS",
      active: false,
      count: 0,
    });
    await expect(repository.mutateReaction(remove)).resolves.toEqual({
      status: "SUCCESS",
      active: false,
      count: 0,
    });
  });

  it("allows muted favorites but rejects banned and unpublished mutations", async () => {
    const repository = createReactionRepository(getDatabase());

    await expect(
      repository.mutateReaction({
        userId: mutedId,
        postId: publishedId,
        kind: "FAVORITE",
        active: true,
      }),
    ).resolves.toEqual({ status: "SUCCESS", active: true, count: 1 });
    await expect(
      repository.mutateReaction({
        userId: bannedId,
        postId: publishedId,
        kind: "LIKE",
        active: true,
      }),
    ).resolves.toEqual({ status: "FORBIDDEN" });
    await expect(
      repository.mutateReaction({
        userId: activeId,
        postId: draftId,
        kind: "LIKE",
        active: true,
      }),
    ).resolves.toEqual({ status: "POST_NOT_FOUND" });
  });

  it("collapses concurrent likes to one row and returns a stable summary", async () => {
    const repository = createReactionRepository(getDatabase());
    const command = {
      userId: activeId,
      postId: publishedId,
      kind: "LIKE",
      active: true,
    } as const;

    await Promise.all(Array.from({ length: 5 }, () => repository.mutateReaction(command)));

    await expect(repository.getSummary(publishedId, activeId)).resolves.toEqual({
      likeCount: 1,
      favoriteCount: 1,
      liked: true,
      favorited: false,
    });
  });
});
