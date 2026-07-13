import { describe, expect, it } from "vitest";

import { decideAdminSeed, parseAdminSeedEnv, type AdminSeedState } from "./seed-admin";

const emptyState: AdminSeedState = {
  normalizedUsername: "kagura_admin",
  existingAdmins: [],
  usernameOwner: null,
};

describe("decideAdminSeed", () => {
  it("creates the first administrator", () => {
    expect(decideAdminSeed(emptyState)).toEqual({ action: "CREATE" });
  });

  it("rotates the credential for the matching sole administrator", () => {
    expect(
      decideAdminSeed({
        ...emptyState,
        existingAdmins: [{ id: "admin-id", normalizedUsername: "kagura_admin" }],
        usernameOwner: { id: "admin-id", role: "ADMIN" },
      }),
    ).toEqual({ action: "ROTATE_CREDENTIAL", userId: "admin-id" });
  });

  it("refuses when a different administrator already exists", () => {
    expect(
      decideAdminSeed({
        ...emptyState,
        existingAdmins: [{ id: "other-admin", normalizedUsername: "other_admin" }],
      }),
    ).toEqual({ action: "REFUSE", reason: "ANOTHER_ADMIN_EXISTS" });
  });

  it("refuses when the requested username belongs to a user", () => {
    expect(
      decideAdminSeed({
        ...emptyState,
        usernameOwner: { id: "user-id", role: "USER" },
      }),
    ).toEqual({ action: "REFUSE", reason: "USERNAME_OWNED_BY_USER" });
  });

  it("refuses ambiguous multiple-administrator state", () => {
    expect(
      decideAdminSeed({
        ...emptyState,
        existingAdmins: [
          { id: "admin-id", normalizedUsername: "kagura_admin" },
          { id: "other-admin", normalizedUsername: "other_admin" },
        ],
        usernameOwner: { id: "admin-id", role: "ADMIN" },
      }),
    ).toEqual({ action: "REFUSE", reason: "MULTIPLE_ADMINS_EXIST" });
  });
});

describe("parseAdminSeedEnv", () => {
  const validInput: NodeJS.ProcessEnv = {
    DATABASE_URL: "postgres://test.invalid/kagura",
    ADMIN_USERNAME: " Kagura_Admin ",
    ADMIN_DISPLAY_NAME: "Kagura",
    ADMIN_PASSWORD: "correct-horse-battery-staple",
  };

  it.each(["short", "x".repeat(257)])(
    "rejects an administrator password outside the 12-256 character boundary",
    (password) => {
      expect(() =>
        parseAdminSeedEnv({
          ...validInput,
          ADMIN_PASSWORD: password,
        }),
      ).toThrowError("Invalid administrator seed environment variables: ADMIN_PASSWORD");
    },
  );

  it("normalizes the administrator username", () => {
    expect(parseAdminSeedEnv(validInput).normalizedUsername).toBe("kagura_admin");
  });
});
