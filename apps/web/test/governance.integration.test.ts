import { randomUUID } from "node:crypto";

import { createDatabaseClient, type DatabaseClient } from "@kagura/database/client";
import { runMigrations } from "@kagura/database/migrate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCommentRepository } from "../src/features/comments/server/comment-repository";
import { createUserRepository } from "../src/features/users/server/user-repository";

const databaseUrl = process.env.TEST_DATABASE_URL;
let database: DatabaseClient | undefined;

function getDatabase(): DatabaseClient {
  if (!database) throw new Error("database client was not initialized");
  return database;
}

describe("administrator governance repository", () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const sessionDigest = suffix.repeat(6).slice(0, 64);
  let adminId = "";
  let userId = "";
  let categoryId = "";
  let postId = "";
  let commentId = "";

  beforeAll(async () => {
    if (!databaseUrl)
      throw new Error("TEST_DATABASE_URL is required for governance integration tests");
    await runMigrations({ databaseUrl });
    database = createDatabaseClient(databaseUrl);
    const userRows = await getDatabase().client<{ id: string; role: string }[]>`
      insert into users (username, normalized_username, display_name, role, status)
      values
        (${`govern_admin_${suffix}`}, ${`govern_admin_${suffix}`}, 'Govern Admin', 'ADMIN', 'ACTIVE'),
        (${`govern_user_${suffix}`}, ${`govern_user_${suffix}`}, 'Govern User', 'USER', 'ACTIVE')
      returning id, role
    `;
    adminId = userRows.find((row) => row.role === "ADMIN")?.id ?? "";
    userId = userRows.find((row) => row.role === "USER")?.id ?? "";
    const [category] = await getDatabase().client<{ id: string }[]>`
      insert into categories (name, slug)
      values ('Govern Category', ${`govern-category-${suffix}`})
      returning id
    `;
    if (!adminId || !userId || !category) throw new Error("governance identities were not created");
    categoryId = category.id;
    const [post] = await getDatabase().client<{ id: string }[]>`
      insert into posts (
        title, slug, excerpt, markdown, rendered_html, category_id, status,
        published_at, reading_minutes, created_by_user_id, updated_by_user_id
      ) values (
        'Govern published', ${`govern-published-${suffix}`}, 'Published',
        '# Published', '<h1>Published</h1>', ${categoryId}, 'PUBLISHED',
        now(), 1, ${adminId}, ${adminId}
      )
      returning id
    `;
    if (!post) throw new Error("governance post was not created");
    postId = post.id;
    const [comment] = await getDatabase().client<{ id: string }[]>`
      insert into comments (post_id, author_user_id, body, status)
      values (${postId}, ${userId}, 'Govern pending', 'PENDING')
      returning id
    `;
    if (!comment) throw new Error("governance comment was not created");
    commentId = comment.id;
    await getDatabase().client`
      insert into sessions (user_id, token_digest, expires_at)
      values (${userId}, ${sessionDigest}, now() + interval '1 day')
    `;
  });

  afterAll(async () => {
    if (!database) return;
    await database.client`delete from audit_logs where actor_user_id = ${adminId}`;
    await database.client`delete from comments where post_id = ${postId}`;
    await database.client`delete from posts where id = ${postId}`;
    await database.client`delete from categories where id = ${categoryId}`;
    await database.client`delete from users where id in (${adminId}, ${userId})`;
    await database.close();
  });

  it("mutes, bans, revokes sessions, and reactivates with audit rows", async () => {
    const repository = createUserRepository(getDatabase());
    const firstAt = new Date("2026-07-14T10:00:00.000Z");

    await expect(
      repository.changeUserStatus({
        actorUserId: adminId,
        targetUserId: userId,
        targetStatus: "MUTED",
        changedAt: firstAt,
      }),
    ).resolves.toEqual({ status: "SUCCESS" });
    await expect(
      repository.changeUserStatus({
        actorUserId: adminId,
        targetUserId: userId,
        targetStatus: "BANNED",
        changedAt: new Date("2026-07-14T10:01:00.000Z"),
      }),
    ).resolves.toEqual({ status: "SUCCESS" });
    const [session] = await getDatabase().client<{ revoked_at: Date | null }[]>`
      select revoked_at from sessions where token_digest = ${sessionDigest}
    `;
    expect(session?.revoked_at).not.toBeNull();
    await expect(
      repository.changeUserStatus({
        actorUserId: adminId,
        targetUserId: userId,
        targetStatus: "ACTIVE",
        changedAt: new Date("2026-07-14T10:02:00.000Z"),
      }),
    ).resolves.toEqual({ status: "SUCCESS" });
    const auditRows = await getDatabase().client<{ action: string }[]>`
      select action from audit_logs
      where actor_user_id = ${adminId} and resource_id = ${userId}
      order by created_at
    `;
    expect(auditRows.map((row) => row.action)).toEqual([
      "USER_MUTED",
      "USER_BANNED",
      "USER_REACTIVATED",
    ]);
  });

  it("rejects stale transitions and administrator self-ban", async () => {
    const repository = createUserRepository(getDatabase());
    await expect(
      repository.changeUserStatus({
        actorUserId: adminId,
        targetUserId: userId,
        targetStatus: "ACTIVE",
        changedAt: new Date(),
      }),
    ).resolves.toEqual({ status: "INVALID_TRANSITION" });
    await expect(
      repository.changeUserStatus({
        actorUserId: adminId,
        targetUserId: adminId,
        targetStatus: "BANNED",
        changedAt: new Date(),
      }),
    ).resolves.toEqual({ status: "FORBIDDEN" });
  });

  it("approves then deletes a comment with audit and public visibility changes", async () => {
    const repository = createUserRepository(getDatabase());
    const publicComments = createCommentRepository(getDatabase());

    await expect(
      repository.moderateComment({
        actorUserId: adminId,
        commentId,
        targetStatus: "APPROVED",
        changedAt: new Date("2026-07-14T10:03:00.000Z"),
      }),
    ).resolves.toEqual({ status: "SUCCESS" });
    await expect(publicComments.listApproved(postId)).resolves.toEqual([
      expect.objectContaining({ id: commentId, body: "Govern pending" }),
    ]);
    await expect(
      repository.moderateComment({
        actorUserId: adminId,
        commentId,
        targetStatus: "DELETED",
        changedAt: new Date("2026-07-14T10:04:00.000Z"),
      }),
    ).resolves.toEqual({ status: "SUCCESS" });
    await expect(publicComments.listApproved(postId)).resolves.toEqual([]);
    const auditRows = await getDatabase().client<{ action: string }[]>`
      select action from audit_logs
      where actor_user_id = ${adminId} and resource_id = ${commentId}
      order by created_at
    `;
    expect(auditRows.map((row) => row.action)).toEqual(["COMMENT_APPROVED", "COMMENT_DELETED"]);
  });
});
