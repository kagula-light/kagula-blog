import { describe, expect, it } from "vitest";

import { validateRegisterActionInput } from "./register-action-state";

function form(overrides: Readonly<Record<string, string>> = {}): FormData {
  const data = new FormData();
  data.set("username", "Kagura_Reader");
  data.set("displayName", "星图读者");
  data.set("password", "correct horse battery staple");
  data.set("passwordConfirmation", "correct horse battery staple");
  data.set("cf-turnstile-response", "turnstile-response");
  for (const [name, value] of Object.entries(overrides)) data.set(name, value);
  return data;
}

describe("validateRegisterActionInput", () => {
  it("returns field errors for malformed registration input", () => {
    expect(
      validateRegisterActionInput(
        form({
          username: "x",
          displayName: "",
          password: "short",
          passwordConfirmation: "different",
          "cf-turnstile-response": "",
        }),
        "https://blog.example.com",
      ),
    ).toEqual({
      success: false,
      state: {
        status: "ERROR",
        fieldErrors: {
          username: ["请输入 3–32 位小写字母、数字或下划线用户名"],
          displayName: ["请输入展示名称"],
          password: ["密码至少需要 12 个字符"],
          passwordConfirmation: ["两次输入的密码不一致"],
          challengeToken: ["请完成人机验证"],
        },
      },
    });
  });

  it("accepts complete registration input", () => {
    expect(
      validateRegisterActionInput(
        form({ next: "/articles/welcome?from=register#comments" }),
        "https://blog.example.com",
      ),
    ).toEqual({
      success: true,
      data: {
        username: "Kagura_Reader",
        displayName: "星图读者",
        password: "correct horse battery staple",
        challengeToken: "turnstile-response",
        nextPath: "/articles/welcome?from=register#comments",
      },
    });
  });

  it.each(["https://attacker.example/path", "//attacker.example/path", "javascript:alert(1)"])(
    "drops an unsafe next destination: %s",
    (next) => {
      const result = validateRegisterActionInput(form({ next }), "https://blog.example.com");
      expect(result.success && result.data.nextPath).toBeNull();
    },
  );
});
