import { createHmac, randomBytes } from "node:crypto";

export interface IssuedSessionToken {
  readonly token: string;
  readonly digest: string;
}

function assertSessionSecret(secret: string): void {
  if (secret.length < 32) {
    throw new Error("Session secret must contain at least 32 characters");
  }
}

export function digestSessionToken(token: string, secret: string): string {
  assertSessionSecret(secret);
  return createHmac("sha256", secret).update(token, "utf8").digest("hex");
}

export function issueSessionToken(secret: string): IssuedSessionToken {
  const token = randomBytes(32).toString("base64url");
  return { token, digest: digestSessionToken(token, secret) };
}
