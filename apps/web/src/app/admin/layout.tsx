import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { site } from "../../data/site";
import { logoutAction } from "../../features/auth/actions/logout-action";
import { getCurrentSession } from "../../server/auth/get-current-session";
import { canAccessAdmin } from "../../server/permissions/policy";

interface AdminLayoutProps {
  readonly children: ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await getCurrentSession();
  if (!session) {
    redirect(`/login?${new URLSearchParams({ next: "/admin" }).toString()}`);
  }
  if (!canAccessAdmin(session)) redirect("/");

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header-inner">
          <a className="admin-brand" href="/admin">
            {site.name}
            <span>管理后台</span>
          </a>

          <div className="admin-account">
            <span>{session.displayName}</span>
            <form action={logoutAction}>
              <button className="secondary-button" type="submit">
                退出登录
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="admin-body">
        <nav className="admin-navigation" aria-label="后台导航">
          <a href="/admin">总览</a>
          <a href="/admin/posts">文章</a>
          <a href="/admin/media">媒体</a>
        </nav>
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
