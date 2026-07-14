import { describe, expect, it } from "vitest";

import { validateLoginActionInput } from "./login-action-state";

const appUrl = "https://blog.example.com";

function createLoginForm(overrides: Readonly<Record<string, string>> = {}): FormData {
  const formData = new FormData();
  formData.set("username", "Kagura_Admin");
  formData.set("password", "correct-horse-battery-staple");

  for (const [name, value] of Object.entries(overrides)) {
    formData.set(name, value);
  }

  return formData;
}

describe("validateLoginActionInput", () => {
  it("returns field errors for malformed credentials", () => {
    const result = validateLoginActionInput(
      createLoginForm({ username: "", password: "" }),
      appUrl,
    );

    expect(result).toEqual({
      success: false,
      state: {
        status: "ERROR",
        fieldErrors: {
          username: ["请输入有效的用户名"],
          password: ["请输入密码"],
        },
      },
    });
  });

  it("accepts a same-origin application path", () => {
    expect(validateLoginActionInput(createLoginForm({ next: "/admin?tab=users" }), appUrl)).toEqual(
      {
        success: true,
        data: {
          username: "Kagura_Admin",
          password: "correct-horse-battery-staple",
          nextPath: "/admin?tab=users",
        },
      },
    );
  });

  it.each(["//evil.example/path", "/\\evil.example/path", "https://evil.example/path", "admin"])(
    "discards an unsafe next destination: %s",
    (next) => {
      const result = validateLoginActionInput(createLoginForm({ next }), appUrl);

      expect(result).toMatchObject({
        success: true,
        data: { nextPath: null },
      });
    },
  );
});
