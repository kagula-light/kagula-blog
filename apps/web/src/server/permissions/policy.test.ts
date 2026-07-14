import { describe, expect, it } from "vitest";

import { canAccessAdmin, canCreateComment, type PermissionIdentity } from "./policy";

const identity = (
  role: PermissionIdentity["role"],
  status: PermissionIdentity["status"],
): PermissionIdentity => ({ id: "user-id", role, status });

describe("permission policy", () => {
  it.each([
    [null, false],
    [identity("USER", "ACTIVE"), false],
    [identity("ADMIN", "ACTIVE"), true],
    [identity("ADMIN", "MUTED"), true],
    [identity("ADMIN", "BANNED"), false],
  ] as const)("evaluates admin access for %j", (subject, expected) => {
    expect(canAccessAdmin(subject)).toBe(expected);
  });

  it.each([
    [null, false],
    [identity("USER", "ACTIVE"), true],
    [identity("ADMIN", "ACTIVE"), true],
    [identity("USER", "MUTED"), false],
    [identity("USER", "BANNED"), false],
  ] as const)("evaluates comment creation for %j", (subject, expected) => {
    expect(canCreateComment(subject)).toBe(expected);
  });
});
