import { normalizeUsername } from "@kagura/auth/username";
import { z } from "zod";

export interface LoginFieldErrors {
  readonly username?: ReadonlyArray<string>;
  readonly password?: ReadonlyArray<string>;
}

export interface LoginActionState {
  readonly status: "IDLE" | "ERROR";
  readonly fieldErrors?: LoginFieldErrors;
  readonly message?: string;
}

export type LoginActionValidation =
  | {
      readonly success: true;
      readonly data: Readonly<{
        username: string;
        password: string;
        nextPath: string | null;
      }>;
    }
  | { readonly success: false; readonly state: LoginActionState };

const loginInputSchema = z.object({
  username: z.preprocess(
    (value) => (typeof value === "string" ? value : ""),
    z
      .string()
      .trim()
      .refine(
        (value) => {
          try {
            normalizeUsername(value);
            return true;
          } catch {
            return false;
          }
        },
        { message: "请输入有效的用户名" },
      ),
  ),
  password: z.preprocess(
    (value) => (typeof value === "string" ? value : ""),
    z.string().min(1, "请输入密码").max(256, "密码不能超过 256 个字符"),
  ),
});

function resolveSafeNextPath(value: FormDataEntryValue | null, appUrl: string): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  try {
    const applicationUrl = new URL(appUrl);
    const destination = new URL(value, applicationUrl);
    if (destination.origin !== applicationUrl.origin) {
      return null;
    }

    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return null;
  }
}

export function validateLoginActionInput(
  formData: FormData,
  appUrl: string,
): LoginActionValidation {
  const result = loginInputSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!result.success) {
    const fieldErrors = z.flattenError(result.error).fieldErrors;
    return {
      success: false,
      state: {
        status: "ERROR",
        fieldErrors: {
          ...(fieldErrors.username ? { username: fieldErrors.username } : {}),
          ...(fieldErrors.password ? { password: fieldErrors.password } : {}),
        },
      },
    };
  }

  return {
    success: true,
    data: {
      ...result.data,
      nextPath: resolveSafeNextPath(formData.get("next"), appUrl),
    },
  };
}
