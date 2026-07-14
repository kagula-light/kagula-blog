import { randomUUID } from "node:crypto";

import { createDatabaseClient, type DatabaseClient } from "@kagura/database/client";
import { runMigrations } from "@kagura/database/migrate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PermissionIdentity } from "../src/server/permissions/policy";
import { renderMarkdown } from "../src/features/posts/server/markdown";
import { createPostRepository } from "../src/features/posts/server/post-repository";
import {
  createPostService,
  type EditablePostContent,
  type UpdatePostPersistenceInput,
} from "../src/features/posts/server/post-service";

const databaseUrl = process.env.TEST_DATABASE_URL;
let database: DatabaseClient | undefined;

function getDatabase(): DatabaseClient {
  if (!database) throw new Error("database client was not initialized");
  return database;
}

describe("post management transactions", () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  let actor: PermissionIdentity = { id: "", role: "ADMIN", status: "ACTIVE" };
  let categoryId = "";
  let tagId = "";

  beforeAll(async () => {
    if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required for integration tests");
    await runMigrations({ databaseUrl });
    database = createDatabaseClient(databaseUrl);

    const [user] = await getDatabase().client<{ id: string }[]>`
      insert into users (username, normalized_username, display_name, role)
      values (${`post_admin_${suffix}`}, ${`post_admin_${suffix}`}, 'Post Admin', 'ADMIN')
      returning id
    `;
    const [category] = await getDatabase().client<{ id: string }[]>`
      insert into categories (name, slug)
      values ('Post Integration', ${`post-category-${suffix}`})
      returning id
    `;
    const [tag] = await getDatabase().client<{ id: string }[]>`
      insert into tags (name, slug)
      values ('Post Integration', ${`post-tag-${suffix}`})
      returning id
    `;
    if (!user || !category || !tag) throw new Error("post fixture was not created");
    actor = { id: user.id, role: "ADMIN", status: "ACTIVE" };
    categoryId = category.id;
    tagId = tag.id;
  });

  afterAll(async () => {
    if (!database) return;
    await database.client`delete from posts where created_by_user_id = ${actor.id}`;
    await database.client`delete from tags where id = ${tagId}`;
    await database.client`delete from categories where id = ${categoryId}`;
    await database.client`delete from audit_logs where actor_user_id = ${actor.id}`;
    await database.client`delete from users where id = ${actor.id}`;
    await database.close();
  });

  function editable(overrides: Partial<EditablePostContent> = {}): EditablePostContent {
    return {
      title: "Transactional post",
      slug: `transactional-post-${suffix}`,
      excerpt: "A transaction test.",
      markdown: "# Transactional post\n\nStored atomically.",
      aiSummary: null,
      categoryId,
      tagIds: [tagId],
      coverMediaId: null,
      seoTitle: null,
      seoDescription: null,
      socialMediaId: null,
      ...overrides,
    };
  }

  it("creates, revises, redirects, audits, and rejects a repeated version", async () => {
    const repository = createPostRepository(getDatabase());
    let lastUpdate: UpdatePostPersistenceInput | undefined;
    const service = createPostService({
      ...repository,
      updatePost: async (input) => {
        lastUpdate = input;
        return repository.updatePost(input);
      },
      renderMarkdown,
      clock: () => new Date("2026-07-14T04:00:00.000Z"),
    });

    const draft = await service.createDraft(actor, editable());
    const published = await service.update(actor, {
      postId: draft.id,
      expectedVersion: draft.version,
      content: editable({ slug: `published-post-${suffix}` }),
      targetStatus: "PUBLISHED",
    });

    expect(published).toMatchObject({ status: "PUBLISHED", version: 2 });
    const [facts] = await getDatabase().client<
      { revision_count: number; redirect_count: number; audit_count: number; tag_count: number }[]
    >`
      select
        (select count(*)::int from post_revisions where post_id = ${draft.id}) as revision_count,
        (select count(*)::int from post_slug_redirects where post_id = ${draft.id}) as redirect_count,
        (select count(*)::int from audit_logs where resource_id = ${draft.id}) as audit_count,
        (select count(*)::int from post_tags where post_id = ${draft.id}) as tag_count
    `;
    expect(facts).toEqual({
      revision_count: 2,
      redirect_count: 1,
      audit_count: 2,
      tag_count: 1,
    });
    if (!lastUpdate) throw new Error("update input was not captured");
    await expect(repository.updatePost(lastUpdate)).rejects.toThrow(/version/i);
  });

  it("rolls back a draft when a referenced tag does not exist", async () => {
    const repository = createPostRepository(getDatabase());
    const service = createPostService({
      ...repository,
      renderMarkdown,
      clock: () => new Date("2026-07-14T04:00:00.000Z"),
    });
    const slug = `invalid-tag-${suffix}`;

    await expect(
      service.createDraft(actor, editable({ slug, tagIds: [randomUUID()] })),
    ).rejects.toThrow(/tag/i);
    const rows = await getDatabase().client<{ count: number }[]>`
      select count(*)::int as count from posts where slug = ${slug}
    `;
    expect(rows[0]?.count).toBe(0);
  });
});
