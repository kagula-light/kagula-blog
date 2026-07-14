import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "../../../components/auth/login-form";
import { site } from "../../../data/site";
import { getCurrentSession } from "../../../server/auth/get-current-session";

export const metadata: Metadata = {
  title: `登录 | ${site.name}`,
};

interface LoginPageProps {
  readonly searchParams: Promise<Readonly<{ next?: string | ReadonlyArray<string> }>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getCurrentSession();
  if (session?.role === "ADMIN") redirect("/admin");

  const parameters = await searchParams;
  const nextPath = typeof parameters.next === "string" ? parameters.next : undefined;

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-heading">
          <p className="login-brand">{site.name}</p>
          <h1 id="login-title">账号登录</h1>
          <p>使用站点账号进入个人功能或管理后台。</p>
        </div>
        <LoginForm {...(nextPath ? { nextPath } : {})} />
        <p className="auth-switch">
          还没有账号？ <a href="/register">注册</a>
        </p>
        <a className="text-link" href="/">
          返回首页
        </a>
      </section>
    </main>
  );
}
