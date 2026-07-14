"use client";

import Link from "next/link";
import Script from "next/script";
import { useActionState, useEffect } from "react";

import { registerAction } from "../../features/registration/actions/register-action";
import type { RegisterActionState } from "../../features/registration/actions/register-action-state";

const initialState: RegisterActionState = { status: "IDLE" };

declare global {
  interface Window {
    turnstile?: Readonly<{ reset: () => void }>;
  }
}

export interface RegisterFormProps {
  readonly siteKey: string;
  readonly nextPath?: string;
}

export function RegisterForm({ siteKey, nextPath }: RegisterFormProps) {
  const [state, formAction, pending] = useActionState(registerAction, initialState);
  const errors = state.fieldErrors;

  useEffect(() => {
    if (state.status === "ERROR") window.turnstile?.reset();
  }, [state]);

  return (
    <>
      <Script
        id="cloudflare-turnstile"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
      />
      <form action={formAction} className="login-form" noValidate>
        {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}

        <div className="login-field">
          <label htmlFor="register-username">用户名</label>
          <input
            id="register-username"
            name="username"
            type="text"
            autoComplete="username"
            aria-invalid={errors?.username ? true : undefined}
            aria-describedby={errors?.username ? "register-username-error" : undefined}
            disabled={pending}
            minLength={3}
            maxLength={32}
            required
          />
          {errors?.username?.[0] ? (
            <p id="register-username-error" className="form-error">
              {errors.username[0]}
            </p>
          ) : null}
        </div>

        <div className="login-field">
          <label htmlFor="register-display-name">展示名称</label>
          <input
            id="register-display-name"
            name="displayName"
            type="text"
            autoComplete="nickname"
            aria-invalid={errors?.displayName ? true : undefined}
            aria-describedby={errors?.displayName ? "register-display-name-error" : undefined}
            disabled={pending}
            maxLength={80}
            required
          />
          {errors?.displayName?.[0] ? (
            <p id="register-display-name-error" className="form-error">
              {errors.displayName[0]}
            </p>
          ) : null}
        </div>

        <div className="login-field">
          <label htmlFor="register-password">密码</label>
          <input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={errors?.password ? true : undefined}
            aria-describedby={errors?.password ? "register-password-error" : undefined}
            disabled={pending}
            minLength={12}
            maxLength={256}
            required
          />
          {errors?.password?.[0] ? (
            <p id="register-password-error" className="form-error">
              {errors.password[0]}
            </p>
          ) : null}
        </div>

        <div className="login-field">
          <label htmlFor="register-password-confirmation">确认密码</label>
          <input
            id="register-password-confirmation"
            name="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            aria-invalid={errors?.passwordConfirmation ? true : undefined}
            aria-describedby={
              errors?.passwordConfirmation ? "register-password-confirmation-error" : undefined
            }
            disabled={pending}
            maxLength={256}
            required
          />
          {errors?.passwordConfirmation?.[0] ? (
            <p id="register-password-confirmation-error" className="form-error">
              {errors.passwordConfirmation[0]}
            </p>
          ) : null}
        </div>

        <div className="login-field">
          <span>人机验证</span>
          <div
            className="cf-turnstile turnstile-container"
            data-sitekey={siteKey}
            data-theme="dark"
            data-language="zh-CN"
            data-refresh-expired="auto"
          />
          {errors?.challengeToken?.[0] ? (
            <p className="form-error">{errors.challengeToken[0]}</p>
          ) : null}
        </div>

        {state.message ? (
          <p className="form-message" role="alert">
            {state.message}
          </p>
        ) : null}

        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? "正在创建账号" : "创建账号"}
        </button>
        <p className="auth-switch">
          已有账号？ <Link href="/login">登录</Link>
        </p>
      </form>
    </>
  );
}
