"use server";

import { digestSessionToken } from "@kagura/auth/session-token";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createAuthRepository } from "../../../server/auth/auth-repository";
import { clearSessionCookie, readSessionCookie } from "../../../server/auth/session-cookie";
import { getServerEnv } from "../../../server/config/env";
import { getDatabase } from "../../../server/database/get-database";

export async function logoutAction(): Promise<void> {
  const env = getServerEnv();
  const cookieStore = await cookies();
  const token = readSessionCookie(cookieStore, env.SESSION_COOKIE_NAME);

  if (token) {
    const repository = createAuthRepository(getDatabase());
    await repository.revokeSession(digestSessionToken(token, env.SESSION_SECRET), new Date());
  }

  clearSessionCookie(cookieStore, {
    name: env.SESSION_COOKIE_NAME,
    secure: new URL(env.APP_URL).protocol === "https:",
  });
  redirect("/login");
}
