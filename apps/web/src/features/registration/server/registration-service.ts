import { createHash } from "node:crypto";

import { normalizeUsername } from "@kagura/auth/username";

export interface RegistrationInput {
  readonly username: string;
  readonly displayName: string;
  readonly password: string;
  readonly challengeToken: string;
  readonly clientAddress: string;
}

export interface RegistrationCreation {
  readonly username: string;
  readonly normalizedUsername: string;
  readonly displayName: string;
  readonly passwordHash: string;
  readonly sessionDigest: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export interface RegistrationServiceDependencies {
  readonly verifyChallenge: (token: string, clientAddress: string) => Promise<boolean>;
  readonly consumeRegistrationBudget: (
    key: string,
  ) => Promise<Readonly<{ allowed: boolean; retryAfterSeconds: number }>>;
  readonly hashPassword: (password: string) => Promise<string>;
  readonly issueToken: () => Readonly<{ token: string; digest: string }>;
  readonly createUserCredentialSession: (
    creation: RegistrationCreation,
  ) => Promise<"CREATED" | "USERNAME_TAKEN">;
  readonly sessionTtlHours: number;
  readonly clock: () => Date;
}

export type RegistrationResult =
  | { readonly status: "SUCCESS"; readonly token: string; readonly expiresAt: Date }
  | { readonly status: "USERNAME_TAKEN" }
  | { readonly status: "CHALLENGE_FAILED" }
  | { readonly status: "INVALID_INPUT" }
  | { readonly status: "RATE_LIMITED"; readonly retryAfterSeconds: number };

export function createRegistrationRateLimitKey(clientAddress: string): string {
  const digest = createHash("sha256").update(clientAddress, "utf8").digest("hex");
  return `registration:${digest}`;
}

interface ValidRegistrationInput {
  readonly username: string;
  readonly displayName: string;
}

function validateRegistrationInput(input: RegistrationInput): ValidRegistrationInput | null {
  try {
    const username = normalizeUsername(input.username);
    const displayName = input.displayName.normalize("NFKC").trim();
    if (displayName.length < 1 || displayName.length > 80) return null;
    if (input.password.length < 12 || input.password.length > 256) return null;
    if (!input.challengeToken.trim() || input.challengeToken.length > 4096) return null;
    return { username, displayName };
  } catch {
    return null;
  }
}

export function createRegistrationService(
  dependencies: RegistrationServiceDependencies,
): (input: RegistrationInput) => Promise<RegistrationResult> {
  return async (input) => {
    const validInput = validateRegistrationInput(input);
    if (!validInput) return { status: "INVALID_INPUT" };

    const budgetKey = createRegistrationRateLimitKey(input.clientAddress);
    const budget = await dependencies.consumeRegistrationBudget(budgetKey);
    if (!budget.allowed) {
      return { status: "RATE_LIMITED", retryAfterSeconds: budget.retryAfterSeconds };
    }

    const challengePassed = await dependencies.verifyChallenge(
      input.challengeToken,
      input.clientAddress,
    );
    if (!challengePassed) return { status: "CHALLENGE_FAILED" };

    const [passwordHash, issued] = await Promise.all([
      dependencies.hashPassword(input.password),
      Promise.resolve(dependencies.issueToken()),
    ]);
    const createdAt = dependencies.clock();
    const expiresAt = new Date(
      createdAt.getTime() + dependencies.sessionTtlHours * 60 * 60 * 1_000,
    );
    const creation = await dependencies.createUserCredentialSession({
      username: validInput.username,
      normalizedUsername: validInput.username,
      displayName: validInput.displayName,
      passwordHash,
      sessionDigest: issued.digest,
      createdAt,
      expiresAt,
    });
    if (creation === "USERNAME_TAKEN") return { status: "USERNAME_TAKEN" };

    return { status: "SUCCESS", token: issued.token, expiresAt };
  };
}
