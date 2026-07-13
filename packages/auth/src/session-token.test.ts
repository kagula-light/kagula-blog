import { describe, expect, it } from "vitest";

import { digestSessionToken, issueSessionToken } from "./session-token";

const sessionSecret = "test_session_secret_that_is_at_least_32_chars";

describe("session tokens", () => {
  it("issues an opaque token and reproducible HMAC digest", () => {
    const issued = issueSessionToken(sessionSecret);

    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(issued.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digestSessionToken(issued.token, sessionSecret)).toBe(issued.digest);
  });

  it("binds the digest to the configured secret", () => {
    const issued = issueSessionToken(sessionSecret);

    expect(digestSessionToken(issued.token, `${sessionSecret}_different`)).not.toBe(issued.digest);
  });

  it("rejects short secrets without echoing them", () => {
    const shortSecret = "too-short";

    expect(() => issueSessionToken(shortSecret)).toThrow(/session secret/i);
    expect(() => issueSessionToken(shortSecret)).not.toThrow(shortSecret);
  });
});
