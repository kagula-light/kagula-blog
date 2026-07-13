import { hash, type Options, verify } from "@node-rs/argon2";

const passwordOptions = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const satisfies Options;

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 256) {
    throw new Error("Password must contain 12-256 characters");
  }

  return hash(password, passwordOptions);
}

export async function verifyPassword(encodedHash: string, password: string): Promise<boolean> {
  try {
    return await verify(encodedHash, password);
  } catch {
    return false;
  }
}
