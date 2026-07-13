import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { auditLogs, credentials, sessions, userRole, users, userStatus } from "./schema";

describe("identity schema", () => {
  it("defines stable user role and status enums", () => {
    expect(userRole.enumValues).toEqual(["ADMIN", "USER"]);
    expect(userStatus.enumValues).toEqual(["ACTIVE", "MUTED", "BANNED"]);
  });

  it.each([
    [users, "users"],
    [credentials, "credentials"],
    [sessions, "sessions"],
    [auditLogs, "audit_logs"],
  ] as const)("maps a domain table to %s", (table, expectedName) => {
    expect(getTableName(table)).toBe(expectedName);
  });

  it("contains the required identity columns", () => {
    expect(Object.keys(getTableColumns(users))).toEqual(
      expect.arrayContaining([
        "id",
        "username",
        "normalizedUsername",
        "displayName",
        "role",
        "status",
        "createdAt",
        "updatedAt",
        "lastLoginAt",
      ]),
    );
    expect(Object.keys(getTableColumns(credentials))).toEqual([
      "userId",
      "passwordHash",
      "passwordUpdatedAt",
    ]);
    expect(Object.keys(getTableColumns(sessions))).toEqual(
      expect.arrayContaining([
        "id",
        "userId",
        "tokenDigest",
        "expiresAt",
        "lastActivityAt",
        "revokedAt",
        "createdAt",
      ]),
    );
    expect(Object.keys(getTableColumns(auditLogs))).toEqual(
      expect.arrayContaining([
        "id",
        "actorUserId",
        "action",
        "resourceType",
        "resourceId",
        "requestId",
        "summary",
        "createdAt",
      ]),
    );
  });
});
