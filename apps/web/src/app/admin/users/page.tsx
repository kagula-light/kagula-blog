import type { Metadata } from "next";

import { UserList } from "../../../components/admin/user-list";
import { site } from "../../../data/site";
import { createUserRepository } from "../../../features/users/server/user-repository";
import { getDatabase } from "../../../server/database/get-database";
import type { UserStatus } from "../../../server/permissions/policy";

export const metadata: Metadata = { title: `用户管理 | ${site.name}` };

interface AdminUsersPageProps {
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}

function readStatus(value: string | string[] | undefined): UserStatus | undefined {
  return value === "ACTIVE" || value === "MUTED" || value === "BANNED" ? value : undefined;
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const parameters = await searchParams;
  const query = typeof parameters.q === "string" ? parameters.q.slice(0, 80) : "";
  const status = readStatus(parameters.status);
  const users = await createUserRepository(getDatabase()).listUsers({
    ...(query ? { query } : {}),
    ...(status ? { status } : {}),
  });

  return (
    <section className="admin-content-page" aria-labelledby="users-title">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">账号治理</p>
          <h1 id="users-title">用户</h1>
          <p>查询用户，并管理禁言、封禁和恢复状态。</p>
        </div>
      </div>
      <form className="admin-filter-bar" action="/admin/users" method="get" role="search">
        <label className="sr-only" htmlFor="user-query">
          搜索用户名或显示名
        </label>
        <input
          id="user-query"
          name="q"
          type="search"
          defaultValue={query}
          maxLength={80}
          placeholder="搜索用户名或显示名"
        />
        <label className="sr-only" htmlFor="user-status">
          用户状态
        </label>
        <select id="user-status" name="status" defaultValue={status ?? ""}>
          <option value="">全部状态</option>
          <option value="ACTIVE">正常</option>
          <option value="MUTED">禁言</option>
          <option value="BANNED">封禁</option>
        </select>
        <button type="submit">筛选</button>
      </form>
      <UserList users={users} />
    </section>
  );
}
