import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("hashes and verifies a valid password with Argon2id", async () => {
    const password = "correct horse battery staple";
    const encodedHash = await hashPassword(password);

    expect(encodedHash).toMatch(/^\$argon2id\$/);
    expect(encodedHash).not.toContain(password);
    await expect(verifyPassword(encodedHash, password)).resolves.toBe(true);
    await expect(verifyPassword(encodedHash, "wrong password value")).resolves.toBe(false);
  });

  it("returns false for a malformed stored hash", async () => {
    await expect(verifyPassword("not-an-argon-hash", "candidate password")).resolves.toBe(false);
  });

  it.each(["short", "x".repeat(257)])("rejects unsupported password length", async (password) => {
    await expect(hashPassword(password)).rejects.toThrow(/password/i);
  });
});
