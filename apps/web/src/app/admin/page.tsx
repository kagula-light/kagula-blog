import type { Metadata } from "next";

import { site } from "../../data/site";

export const metadata: Metadata = {
  title: `管理后台 | ${site.name}`,
};

export default function AdminPage() {
  return (
    <section className="admin-overview" aria-labelledby="admin-title">
      <p className="admin-eyebrow">系统状态</p>
      <h1 id="admin-title">管理后台</h1>
      <p>身份认证、数据库会话与服务端权限基础已启用。</p>

      <dl className="foundation-list">
        <div>
          <dt>身份验证</dt>
          <dd>用户名与密码</dd>
        </div>
        <div>
          <dt>会话</dt>
          <dd>服务端数据库会话</dd>
        </div>
        <div>
          <dt>权限</dt>
          <dd>管理员入口已保护</dd>
        </div>
      </dl>
    </section>
  );
}
