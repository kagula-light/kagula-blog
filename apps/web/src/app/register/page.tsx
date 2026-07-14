import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RegisterForm } from "../../components/auth/register-form";
import { site } from "../../data/site";
import { getCurrentSession } from "../../server/auth/get-current-session";
import { getServerEnv } from "../../server/config/env";

export const metadata: Metadata = {
  title: `注册 | ${site.name}`,
};

interface RegisterPageProps {
  readonly searchParams: Promise<Readonly<{ next?: string | readonly string[] }>>;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const session = await getCurrentSession();
  if (session) redirect("/account");

  const parameters = await searchParams;
  const nextPath = typeof parameters.next === "string" ? parameters.next : undefined;
  const env = getServerEnv();

  return (
    <main className="login-page">
      <section className="login-panel register-panel" aria-labelledby="register-title">
        <div className="login-heading">
          <p className="login-brand">{site.name}</p>
          <h1 id="register-title">创建读者账号</h1>
          <p>注册后可收藏文章、参与评论并管理个人活动。</p>
        </div>
        <RegisterForm siteKey={env.TURNSTILE_SITE_KEY} {...(nextPath ? { nextPath } : {})} />
        <a className="text-link" href="/">
          返回首页
        </a>
      </section>
    </main>
  );
}
