import { digestSessionToken } from "@kagura/auth/session-token";
import { cookies } from "next/headers";

import type { PermissionIdentity, UserRole, UserStatus } from "../permissions/policy";
import { getServerEnv } from "../config/env";
import { getDatabase } from "../database/get-database";
import { createAuthRepository } from "./auth-repository";
import { readSessionCookie } from "./session-cookie";

export interface SessionIdentity extends PermissionIdentity {
  readonly sessionId: string;
  readonly username: string;
  readonly displayName: string;
  readonly role: UserRole;
  readonly status: UserStatus;
}

export interface ResolveCurrentSessionInput {
  readonly token: string | null;
  readonly sessionSecret: string;
  readonly now: Date;
  readonly findSessionIdentity: (
    digest: string,
    now: Date,
  ) => Promise<SessionIdentity | null>;
}

export async function resolveCurrentSession({
  token,
  sessionSecret,
  now,
  findSessionIdentity,
}: ResolveCurrentSessionInput): Promise<SessionIdentity | null> {
  if (!token) return null;

  const digest = digestSessionToken(token, sessionSecret);
  const identity = await findSessionIdentity(digest, now);
  return identity?.status === "BANNED" ? null : identity;
}

export async function getCurrentSession(): Promise<SessionIdentity | null> {
  const cookieStore = await cookies();
  const env = getServerEnv();
  const token = readSessionCookie(cookieStore, env.SESSION_COOKIE_NAME);
  const repository = createAuthRepository(getDatabase());

  return resolveCurrentSession({
    token,
    sessionSecret: env.SESSION_SECRET,
    now: new Date(),
    findSessionIdentity: repository.findSessionIdentity,
  });
}
