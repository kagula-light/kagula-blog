import { randomUUID } from "node:crypto";

import { createDatabaseClient, type DatabaseClient } from "@kagura/database/client";
import { runMigrations } from "@kagura/database/migrate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPublicPostRepository } from "../src/features/posts/server/public-post-repository";

const databaseUrl = process.env.TEST_DATABASE_URL;
let database: DatabaseClient | undefined;

function getDatabase(): DatabaseClient {
  if (!database) throw new Error("database client was not initialized");
  return database;
}

describe("public post visibility", () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  let authorId = "";
  let categoryId = "";
  let tagId = "";
  let publishedId = "";

  beforeAll(async () => {
    if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required for integration tests");
    await runMigrations({ databaseUrl });
    database = createDatabaseClient(databaseUrl);
    const [author] = await getDatabase().client<{ id: string }[]>`
      insert into users (username, normalized_username, display_name, role)
      values (${`public_${suffix}`}, ${`public_${suffix}`}, 'Public Test', 'ADMIN') returning id
    `;
    const [category] = await getDatabase().client<{ id: string }[]>`
      insert into categories (name, slug)
      values ('Public Category', ${`public-category-${suffix}`}) returning id
    `;
    const [tag] = await getDatabase().client<{ id: string }[]>`
      insert into tags (name, slug)
      values ('Public Tag', ${`public-tag-${suffix}`}) returning id
    `;
    if (!author || !category || !tag) throw new Error("public fixture was not created");
    authorId = author.id;
    categoryId = category.id;
    tagId = tag.id;

    const rows = await getDatabase().client<{ id: string; status: string }[]>`
      insert into posts (
        title, slug, excerpt, markdown, rendered_html, category_id, status,
        scheduled_for, published_at, archived_at, reading_minutes,
        created_by_user_id, updated_by_user_id
      ) values
        ('Visible constellation', ${`visible-${suffix}`}, 'Published search needle', '# Visible', '<h1 id="visible">Visible</h1>', ${categoryId}, 'PUBLISHED', null, now(), null, 1, ${authorId}, ${authorId}),
        ('Hidden draft', ${`draft-${suffix}`}, 'Draft search needle', '# Draft', '<h1 id="draft">Draft</h1>', ${categoryId}, 'DRAFT', null, null, null, 1, ${authorId}, ${authorId}),
        ('Hidden schedule', ${`scheduled-${suffix}`}, 'Scheduled search needle', '# Scheduled', '<h1 id="scheduled">Scheduled</h1>', ${categoryId}, 'SCHEDULED', now() + interval '1 day', null, null, 1, ${authorId}, ${authorId}),
        ('Hidden archive', ${`archived-${suffix}`}, 'Archived search needle', '# Archived', '<h1 id="archived">Archived</h1>', ${categoryId}, 'ARCHIVED', null, now() - interval '2 days', now(), 1, ${authorId}, ${authorId})
      returning id, status
    `;
    publishedId = rows.find((row) => row.status === "PUBLISHED")?.id ?? "";
    const draftId = rows.find((row) => row.status === "DRAFT")?.id ?? "";
    if (!publishedId || !draftId) throw new Error("public post fixture was not created");
    await getDatabase()
      .client`insert into post_tags (post_id, tag_id) values (${publishedId}, ${tagId})`;
    await getDatabase().client`
      insert into post_slug_redirects (post_id, old_slug)
      values (${publishedId}, ${`visible-old-${suffix}`}), (${draftId}, ${`draft-old-${suffix}`})
    `;
  });

  afterAll(async () => {
    if (!database) return;
    await database.client`delete from posts where created_by_user_id = ${authorId}`;
    await database.client`delete from tags where id = ${tagId}`;
    await database.client`delete from categories where id = ${categoryId}`;
    await database.client`delete from users where id = ${authorId}`;
    await database.close();
  });

  it("lists and searches only published posts", async () => {
    const repository = createPublicPostRepository(getDatabase());

    const listed = await repository.listPublished(100);
    expect(listed.filter((post) => post.id === publishedId)).toHaveLength(1);
    await expect(repository.search("Draft search needle")).resolves.toEqual([]);
    await expect(repository.search("Published search needle")).resolves.toEqual([
      expect.objectContaining({ id: publishedId }),
    ]);
  });

  it("filters published posts by category and tag", async () => {
    const repository = createPublicPostRepository(getDatabase());

    await expect(repository.listByCategory(`public-category-${suffix}`)).resolves.toEqual([
      expect.objectContaining({ id: publishedId }),
    ]);
    await expect(repository.listByTag(`public-tag-${suffix}`)).resolves.toEqual([
      expect.objectContaining({ id: publishedId }),
    ]);
  });

  it("resolves only redirects owned by published posts", async () => {
    const repository = createPublicPostRepository(getDatabase());

    await expect(repository.resolveSlug(`visible-old-${suffix}`)).resolves.toEqual({
      kind: "REDIRECT",
      slug: `visible-${suffix}`,
    });
    await expect(repository.resolveSlug(`draft-old-${suffix}`)).resolves.toEqual({
      kind: "NOT_FOUND",
    });
  });
});
