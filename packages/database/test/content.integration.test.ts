import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

import { runMigrations } from "../src/migrate";

const databaseUrl = process.env.TEST_DATABASE_URL;
let client: ReturnType<typeof postgres> | undefined;

function getClient(): ReturnType<typeof postgres> {
  if (!client) throw new Error("database client was not initialized");
  return client;
}

async function createContentOwners() {
  const sql = getClient();
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const [author] = await sql<{ id: string }[]>`
    insert into users (username, normalized_username, display_name, role)
    values (${`content_${suffix}`}, ${`content_${suffix}`}, 'Content Author', 'ADMIN')
    returning id
  `;
  const [category] = await sql<{ id: string }[]>`
    insert into categories (name, slug)
    values ('Integration Category', ${`category-${suffix}`})
    returning id
  `;
  if (!author || !category) throw new Error("content fixture was not created");

  return { authorId: author.id, categoryId: category.id, suffix };
}

async function removeContentOwners(authorId: string, categoryId: string): Promise<void> {
  const sql = getClient();
  await sql`delete from categories where id = ${categoryId}`;
  await sql`delete from users where id = ${authorId}`;
}

describe("content database constraints", () => {
  beforeAll(async () => {
    if (!databaseUrl) {
      throw new Error("TEST_DATABASE_URL is required for database integration tests");
    }

    await runMigrations({ databaseUrl });
    client = postgres(databaseUrl, { max: 1 });
  });

  afterAll(async () => {
    await client?.end({ timeout: 5 });
  });

  it("enforces publication timestamps and unique post slugs", async () => {
    const sql = getClient();
    const { authorId, categoryId, suffix } = await createContentOwners();
    const slug = `post-${suffix}`;

    try {
      await expect(
        sql`
          insert into posts (
            title, slug, excerpt, markdown, rendered_html, category_id,
            status, reading_minutes, created_by_user_id, updated_by_user_id
          ) values (
            'Scheduled without a time', ${`scheduled-${suffix}`}, 'Excerpt', '# Draft', '<h1>Draft</h1>',
            ${categoryId}, 'SCHEDULED', 1, ${authorId}, ${authorId}
          )
        `,
      ).rejects.toThrow();

      await sql`
        insert into posts (
          title, slug, excerpt, markdown, rendered_html, category_id,
          reading_minutes, created_by_user_id, updated_by_user_id
        ) values (
          'Draft post', ${slug}, 'Excerpt', '# Draft', '<h1>Draft</h1>', ${categoryId},
          1, ${authorId}, ${authorId}
        )
      `;

      await expect(
        sql`
          insert into posts (
            title, slug, excerpt, markdown, rendered_html, category_id,
            reading_minutes, created_by_user_id, updated_by_user_id
          ) values (
            'Duplicate slug', ${slug}, 'Excerpt', '# Duplicate', '<h1>Duplicate</h1>', ${categoryId},
            1, ${authorId}, ${authorId}
          )
        `,
      ).rejects.toThrow();

      const publicRows = await sql<{ slug: string }[]>`
        select slug from posts where status = 'PUBLISHED' and slug = ${slug}
      `;
      expect(publicRows).toEqual([]);
    } finally {
      await sql`delete from posts where created_by_user_id = ${authorId}`;
      await removeContentOwners(authorId, categoryId);
    }
  });

  it("protects referenced media and deduplicates post tags", async () => {
    const sql = getClient();
    const { authorId, categoryId, suffix } = await createContentOwners();
    let tagId: string | undefined;
    let mediaId: string | undefined;
    let postId: string | undefined;

    try {
      await expect(
        sql`
          insert into media_assets (
            owner_user_id, object_key, mime_type, byte_size, width, height, checksum_sha256
          ) values (
            ${authorId}, ${`invalid/${suffix}.png`}, 'image/png', 0, 1, 1, ${"0".repeat(64)}
          )
        `,
      ).rejects.toThrow();

      const [[media], [tag]] = await Promise.all([
        sql<{ id: string }[]>`
          insert into media_assets (
            owner_user_id, object_key, mime_type, byte_size, width, height, checksum_sha256, status
          ) values (
            ${authorId}, ${`posts/${suffix}.png`}, 'image/png', 128, 16, 16, ${"a".repeat(64)}, 'READY'
          ) returning id
        `,
        sql<{ id: string }[]>`
          insert into tags (name, slug)
          values ('Integration Tag', ${`tag-${suffix}`})
          returning id
        `,
      ]);
      mediaId = media?.id;
      tagId = tag?.id;
      if (!mediaId || !tagId) throw new Error("media fixture was not created");

      const [post] = await sql<{ id: string }[]>`
        insert into posts (
          title, slug, excerpt, markdown, rendered_html, cover_media_id, category_id,
          reading_minutes, created_by_user_id, updated_by_user_id
        ) values (
          'Media post', ${`media-post-${suffix}`}, 'Excerpt', '# Media', '<h1>Media</h1>', ${mediaId},
          ${categoryId}, 1, ${authorId}, ${authorId}
        ) returning id
      `;
      postId = post?.id;
      if (!postId) throw new Error("post fixture was not created");

      await sql`insert into post_tags (post_id, tag_id) values (${postId}, ${tagId})`;
      await expect(
        sql`insert into post_tags (post_id, tag_id) values (${postId}, ${tagId})`,
      ).rejects.toThrow();
      await expect(sql`delete from media_assets where id = ${mediaId}`).rejects.toThrow();
    } finally {
      if (postId) await sql`delete from posts where id = ${postId}`;
      if (mediaId) await sql`delete from media_assets where id = ${mediaId}`;
      if (tagId) await sql`delete from tags where id = ${tagId}`;
      await removeContentOwners(authorId, categoryId);
    }
  });

  it("keeps numbered post revisions immutable", async () => {
    const sql = getClient();
    const { authorId, categoryId, suffix } = await createContentOwners();
    let postId: string | undefined;

    try {
      const [post] = await sql<{ id: string }[]>`
        insert into posts (
          title, slug, excerpt, markdown, rendered_html, category_id,
          reading_minutes, created_by_user_id, updated_by_user_id
        ) values (
          'Revision post', ${`revision-post-${suffix}`}, 'Excerpt', '# Revision', '<h1>Revision</h1>',
          ${categoryId}, 1, ${authorId}, ${authorId}
        ) returning id
      `;
      postId = post?.id;
      if (!postId) throw new Error("post fixture was not created");

      const [revision] = await sql<{ id: string }[]>`
        insert into post_revisions (
          post_id, revision_number, title, slug, excerpt, markdown, rendered_html,
          summary_source, category_id, status, reading_minutes, editor_user_id
        ) values (
          ${postId}, 1, 'Revision post', ${`revision-post-${suffix}`}, 'Excerpt', '# Revision',
          '<h1>Revision</h1>', 'NONE', ${categoryId}, 'DRAFT', 1, ${authorId}
        ) returning id
      `;
      if (!revision) throw new Error("revision fixture was not created");

      await expect(
        sql`
          insert into post_revisions (
            post_id, revision_number, title, slug, excerpt, markdown, rendered_html,
            summary_source, category_id, status, reading_minutes, editor_user_id
          ) values (
            ${postId}, 1, 'Duplicate revision', ${`revision-post-${suffix}`}, 'Excerpt', '# Duplicate',
            '<h1>Duplicate</h1>', 'NONE', ${categoryId}, 'DRAFT', 1, ${authorId}
          )
        `,
      ).rejects.toThrow();
      await expect(
        sql`update post_revisions set title = 'Mutated' where id = ${revision.id}`,
      ).rejects.toThrow(/immutable/i);
    } finally {
      if (postId) await sql`delete from posts where id = ${postId}`;
      await removeContentOwners(authorId, categoryId);
    }
  });
});
