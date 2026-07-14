"use server";

import { hashPassword } from "@kagura/auth/password";
import { issueSessionToken } from "@kagura/auth/session-token";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { setSessionCookie } from "../../../server/auth/session-cookie";
import { getServerEnv } from "../../../server/config/env";
import { getDatabase } from "../../../server/database/get-database";
import { verifyTurnstile } from "../../../server/security/turnstile";
import { createRegistrationRateLimiter } from "../server/registration-rate-limiter";
import { createRegistrationRepository } from "../server/registration-repository";
import { createRegistrationService } from "../server/registration-service";
import { type RegisterActionState, validateRegisterActionInput } from "./register-action-state";

function readClientAddress(headerStore: Headers): string {
  const realAddress = headerStore.get("x-real-ip")?.trim();
  if (realAddress) return realAddress;
  return headerStore.get("x-forwarded-for")?.split(",", 1)[0]?.trim() || "unknown";
}

export async function registerAction(
  _previousState: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> {
  const env = getServerEnv();
  const validation = validateRegisterActionInput(formData, env.APP_URL);
  if (!validation.success) return validation.state;

  const repository = createRegistrationRepository(getDatabase());
  const limiter = createRegistrationRateLimiter(env.REDIS_URL);
  const register = createRegistrationService({
    verifyChallenge: (token, clientAddress) =>
      verifyTurnstile({
        secretKey: env.TURNSTILE_SECRET_KEY,
        responseToken: token,
        clientAddress,
      }),
    consumeRegistrationBudget: limiter.consumeRegistrationBudget,
    hashPassword,
    issueToken: () => issueSessionToken(env.SESSION_SECRET),
    createUserCredentialSession: repository.createUserCredentialSession,
    sessionTtlHours: env.SESSION_TTL_HOURS,
    clock: () => new Date(),
  });
  const headerStore = await headers();
  const result = await register({
    username: validation.data.username,
    displayName: validation.data.displayName,
    password: validation.data.password,
    challengeToken: validation.data.challengeToken,
    clientAddress: readClientAddress(headerStore),
  });

  if (result.status === "USERNAME_TAKEN") {
    return { status: "ERROR", message: "该用户名已被使用" };
  }
  if (result.status === "CHALLENGE_FAILED") {
    return { status: "ERROR", message: "人机验证未通过，请重试" };
  }
  if (result.status === "INVALID_INPUT") {
    return { status: "ERROR", message: "注册信息无效，请检查后重试" };
  }
  if (result.status === "RATE_LIMITED") {
    const retryAfterMinutes = Math.max(1, Math.ceil(result.retryAfterSeconds / 60));
    return {
      status: "ERROR",
      message: `注册尝试过于频繁，请在 ${retryAfterMinutes} 分钟后重试`,
    };
  }

  const cookieStore = await cookies();
  setSessionCookie(cookieStore, {
    name: env.SESSION_COOKIE_NAME,
    token: result.token,
    expiresAt: result.expiresAt,
    secure: new URL(env.APP_URL).protocol === "https:",
  });
  redirect(validation.data.nextPath ?? "/account");
}
