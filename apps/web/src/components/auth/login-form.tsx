"use client";

import { useActionState } from "react";

import { loginAction } from "../../features/auth/actions/login-action";
import type { LoginActionState } from "../../features/auth/actions/login-action-state";

const initialState: LoginActionState = { status: "IDLE" };

export interface LoginFormProps {
  readonly nextPath?: string;
}

export function LoginForm({ nextPath }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const usernameError = state.fieldErrors?.username?.[0];
  const passwordError = state.fieldErrors?.password?.[0];

  return (
    <form action={formAction} className="login-form" noValidate>
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}

      <div className="login-field">
        <label htmlFor="username">用户名</label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          aria-invalid={usernameError ? true : undefined}
          aria-describedby={usernameError ? "username-error" : undefined}
          disabled={pending}
          required
        />
        {usernameError ? (
          <p id="username-error" className="form-error">
            {usernameError}
          </p>
        ) : null}
      </div>

      <div className="login-field">
        <label htmlFor="password">密码</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={passwordError ? "password-error" : undefined}
          disabled={pending}
          required
        />
        {passwordError ? (
          <p id="password-error" className="form-error">
            {passwordError}
          </p>
        ) : null}
      </div>

      {state.message ? (
        <p className="form-message" role="alert">
          {state.message}
        </p>
      ) : null}

      <button className="primary-button" type="submit" disabled={pending}>
        {pending ? "正在登录" : "登录"}
      </button>
    </form>
  );
}
