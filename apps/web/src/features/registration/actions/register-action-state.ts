import { normalizeUsername } from "../../../server/auth/username";
import { z } from "zod";

export interface RegisterFieldErrors {
  readonly username?: readonly string[];
  readonly displayName?: readonly string[];
  readonly password?: readonly string[];
  readonly passwordConfirmation?: readonly string[];
  readonly challengeToken?: readonly string[];
}

export interface RegisterActionState {
  readonly status: "IDLE" | "ERROR";
  readonly fieldErrors?: RegisterFieldErrors;
  readonly message?: string;
}

export type RegisterActionValidation =
  | {
      readonly success: true;
      readonly data: Readonly<{
        username: string;
        displayName: string;
        password: string;
        challengeToken: string;
        nextPath: string | null;
      }>;
    }
  | { readonly success: false; readonly state: RegisterActionState };

const registerInputSchema = z
  .object({
    username: z.preprocess(
      (value) => (typeof value === "string" ? value : ""),
      z.string().refine(
        (value) => {
          try {
            normalizeUsername(value);
            return true;
          } catch {
            return false;
          }
        },
        { message: "请输入 3–32 位小写字母、数字或下划线用户名" },
      ),
    ),
    displayName: z.preprocess(
      (value) => (typeof value === "string" ? value : ""),
      z.string().trim().min(1, "请输入展示名称").max(80, "展示名称不能超过 80 个字符"),
    ),
    password: z.preprocess(
      (value) => (typeof value === "string" ? value : ""),
      z.string().min(12, "密码至少需要 12 个字符").max(256, "密码不能超过 256 个字符"),
    ),
    passwordConfirmation: z.preprocess(
      (value) => (typeof value === "string" ? value : ""),
      z.string().max(256, "密码不能超过 256 个字符"),
    ),
    challengeToken: z.preprocess(
      (value) => (typeof value === "string" ? value : ""),
      z.string().trim().min(1, "请完成人机验证").max(4096, "人机验证响应无效"),
    ),
  })
  .superRefine((value, context) => {
    if (value.password !== value.passwordConfirmation) {
      context.addIssue({
        code: "custom",
        path: ["passwordConfirmation"],
        message: "两次输入的密码不一致",
      });
    }
  });

function resolveSafeNextPath(value: FormDataEntryValue | null, appUrl: string): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  try {
    const applicationUrl = new URL(appUrl);
    const destination = new URL(value, applicationUrl);
    if (destination.origin !== applicationUrl.origin) return null;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return null;
  }
}

export function validateRegisterActionInput(
  formData: FormData,
  appUrl: string,
): RegisterActionValidation {
  const result = registerInputSchema.safeParse({
    username: formData.get("username"),
    displayName: formData.get("displayName"),
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
    challengeToken: formData.get("cf-turnstile-response"),
  });

  if (!result.success) {
    const errors = z.flattenError(result.error).fieldErrors;
    return {
      success: false,
      state: {
        status: "ERROR",
        fieldErrors: {
          ...(errors.username ? { username: errors.username } : {}),
          ...(errors.displayName ? { displayName: errors.displayName } : {}),
          ...(errors.password ? { password: errors.password } : {}),
          ...(errors.passwordConfirmation
            ? { passwordConfirmation: errors.passwordConfirmation }
            : {}),
          ...(errors.challengeToken ? { challengeToken: errors.challengeToken } : {}),
        },
      },
    };
  }

  return {
    success: true,
    data: {
      username: result.data.username,
      displayName: result.data.displayName,
      password: result.data.password,
      challengeToken: result.data.challengeToken,
      nextPath: resolveSafeNextPath(formData.get("next"), appUrl),
    },
  };
}
