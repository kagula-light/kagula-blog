"use server";

import { hashPassword, verifyPassword } from "@kagura/auth/password";
import { issueSessionToken } from "@kagura/auth/session-token";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { createAuthRepository } from "../../../server/auth/auth-repository";
import { createLoginFailureLimiter } from "../../../server/auth/login-rate-limiter";
import { setSessionCookie } from "../../../server/auth/session-cookie";
import { getServerEnv } from "../../../server/config/env";
import { getDatabase } from "../../../server/database/get-database";
import { createLoginService } from "../server/auth-service";
import { type LoginActionState, validateLoginActionInput } from "./login-action-state";

const dummyPasswordHash = hashPassword("kagura-login-dummy-password");

function readClientAddress(headerStore: Headers): string {
  const realAddress = headerStore.get("x-real-ip")?.trim();
  if (realAddress) return realAddress;

  const forwardedAddress = headerStore.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  return forwardedAddress || "unknown";
}

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const env = getServerEnv();
  const validation = validateLoginActionInput(formData, env.APP_URL);
  if (!validation.success) return validation.state;

  const repository = createAuthRepository(getDatabase());
  const limiter = createLoginFailureLimiter(env.REDIS_URL);
  const login = createLoginService({
    findLoginIdentity: repository.findLoginIdentity,
    verifyPassword,
    dummyPasswordHash: await dummyPasswordHash,
    issueToken: () => issueSessionToken(env.SESSION_SECRET),
    createSession: repository.createSession,
    consumeFailureBudget: limiter.consumeFailureBudget,
    recordFailure: limiter.recordFailure,
    clearFailures: limiter.clearFailures,
    sessionTtlHours: env.SESSION_TTL_HOURS,
    clock: () => new Date(),
  });
  const headerStore = await headers();
  const result = await login({
    username: validation.data.username,
    password: validation.data.password,
    clientAddress: readClientAddress(headerStore),
  });

  if (result.status === "INVALID_CREDENTIALS") {
    return { status: "ERROR", message: "用户名或密码错误" };
  }

  if (result.status === "RATE_LIMITED") {
    const retryAfterMinutes = Math.max(1, Math.ceil(result.retryAfterSeconds / 60));
    return {
      status: "ERROR",
      message: `登录尝试过于频繁，请在 ${retryAfterMinutes} 分钟后重试`,
    };
  }

  const cookieStore = await cookies();
  setSessionCookie(cookieStore, {
    name: env.SESSION_COOKIE_NAME,
    token: result.token,
    expiresAt: result.expiresAt,
    secure: new URL(env.APP_URL).protocol === "https:",
  });

  if (result.role !== "ADMIN") redirect("/");
  redirect(validation.data.nextPath ?? "/admin");
}
