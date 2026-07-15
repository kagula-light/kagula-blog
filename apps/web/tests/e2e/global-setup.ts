import { hashPassword } from "@kagura/auth/password";
import { createDatabaseClient } from "@kagura/database/client";
import { categories, credentials, posts, sessions, users } from "@kagura/database/schema";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { inArray } from "drizzle-orm";

import { e2eIdentities } from "./identities";

export default async function globalSetup(): Promise<void> {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required for Playwright setup");

  const database = createDatabaseClient(databaseUrl);

  try {
    await migrate(database.db, { migrationsFolder: "../../packages/database/drizzle" });
    const seededUserIds: Array<string> = [];
    let administratorId = "";
    for (const [identityKey, identity] of Object.entries(e2eIdentities)) {
      const now = new Date();
      const [user] = await database.db
        .insert(users)
        .values({
          username: identity.username,
          normalizedUsername: identity.username,
          displayName: identity.displayName,
          role: identity.role,
          status: identity.status,
        })
        .onConflictDoUpdate({
          target: users.normalizedUsername,
          set: {
            username: identity.username,
            displayName: identity.displayName,
            role: identity.role,
            status: identity.status,
            updatedAt: now,
          },
        })
        .returning({ id: users.id });
      if (!user) throw new Error("Playwright identity was not created");

      const passwordHash = await hashPassword(identity.password);
      await database.db
        .insert(credentials)
        .values({ userId: user.id, passwordHash, passwordUpdatedAt: now })
        .onConflictDoUpdate({
          target: credentials.userId,
          set: { passwordHash, passwordUpdatedAt: now },
        });
      seededUserIds.push(user.id);
      if (identityKey === "admin") administratorId = user.id;
    }

    await database.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(inArray(sessions.userId, seededUserIds));
    await database.db.delete(posts).where(inArray(posts.createdByUserId, seededUserIds));
    if (!administratorId) throw new Error("Playwright administrator was not created");
    const [category] = await database.db
      .select({ id: categories.id })
      .from(categories)
      .where(inArray(categories.slug, ["uncategorized"]))
      .limit(1);
    if (!category) throw new Error("Playwright category was not created");

    const now = new Date("2026-07-14T08:00:00.000Z");
    await database.db.insert(posts).values([
      {
        title: "E2E 公开文章",
        slug: "e2e-public-article",
        excerpt: "用真实浏览器验证公开文章、搜索和阅读布局。",
        markdown:
          "## 星图可见性\n\n只有公开文章会进入这片星图。\n\n### 长内容\n\n`supercalifragilisticexpialidocious-with-a-very-long-suffix`",
        renderedHtml:
          '<h2 id="星图可见性">星图可见性</h2><p>只有公开文章会进入这片星图。</p><h3 id="长内容">长内容</h3><p><code>supercalifragilisticexpialidocious-with-a-very-long-suffix</code></p>',
        aiSummary: "这是一篇用于验证公开内容边界的浏览器测试文章。",
        summarySource: "MANUAL",
        categoryId: category.id,
        status: "PUBLISHED",
        publishedAt: now,
        readingMinutes: 2,
        createdByUserId: administratorId,
        updatedByUserId: administratorId,
        createdAt: now,
        updatedAt: now,
      },
      {
        title: "E2E 隐藏草稿",
        slug: "e2e-hidden-draft",
        excerpt: "绝不能公开的草稿针",
        markdown: "# Hidden",
        renderedHtml: '<h1 id="hidden">Hidden</h1>',
        categoryId: category.id,
        status: "DRAFT",
        readingMinutes: 1,
        createdByUserId: administratorId,
        updatedByUserId: administratorId,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  } finally {
    await database.close();
  }
}
