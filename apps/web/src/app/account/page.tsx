import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteFooter } from "../../components/site/site-footer";
import { SiteHeader } from "../../components/site/site-header";
import { site } from "../../data/site";
import { createAccountRepository } from "../../features/account/server/account-repository";
import { getCurrentSession } from "../../server/auth/get-current-session";
import { getDatabase } from "../../server/database/get-database";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `账号 | ${site.name}`,
};

const roleLabels = { ADMIN: "管理员", USER: "读者" } as const;
const userStatusLabels = { ACTIVE: "正常", MUTED: "已禁言", BANNED: "已封禁" } as const;
const postStatusLabels = {
  DRAFT: "草稿",
  SCHEDULED: "待发布",
  PUBLISHED: "已发布",
  ARCHIVED: "已归档",
} as const;
const commentStatusLabels = {
  PENDING: "待审核",
  APPROVED: "已通过",
  REJECTED: "未通过",
  DELETED: "已删除",
} as const;

function formatActivityDate(value: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function AccountPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login?next=/account");

  const activity = await createAccountRepository(getDatabase()).getActivity(session.id);

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="account-page" tabIndex={-1}>
        <header className="account-header">
          <p>个人星图</p>
          <h1>{session.displayName}</h1>
          <dl>
            <div>
              <dt>用户名</dt>
              <dd>{session.username}</dd>
            </div>
            <div>
              <dt>身份</dt>
              <dd>{roleLabels[session.role]}</dd>
            </div>
            <div>
              <dt>账号状态</dt>
              <dd>{userStatusLabels[session.status]}</dd>
            </div>
          </dl>
        </header>

        <div className="account-activity">
          <section aria-labelledby="account-favorites-title">
            <div className="account-section-heading">
              <h2 id="account-favorites-title">收藏文章</h2>
              <span>{activity.favorites.length}</span>
            </div>
            {activity.favorites.length > 0 ? (
              <ol className="account-list">
                {activity.favorites.map((favorite) => (
                  <li key={favorite.postId}>
                    <div>
                      {favorite.postStatus === "PUBLISHED" ? (
                        <Link href={`/articles/${favorite.slug}`}>{favorite.title}</Link>
                      ) : (
                        <span className="account-item-title">{favorite.title}</span>
                      )}
                      <span>{postStatusLabels[favorite.postStatus]}</span>
                    </div>
                    <time dateTime={favorite.createdAt.toISOString()}>
                      {formatActivityDate(favorite.createdAt)}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="account-empty">还没有收藏文章。</p>
            )}
          </section>

          <section aria-labelledby="account-comments-title">
            <div className="account-section-heading">
              <h2 id="account-comments-title">我的评论</h2>
              <span>{activity.comments.length}</span>
            </div>
            {activity.comments.length > 0 ? (
              <ol className="account-list account-comment-list">
                {activity.comments.map((comment) => (
                  <li key={comment.id}>
                    <div>
                      <Link href={`/articles/${comment.postSlug}`}>{comment.postTitle}</Link>
                      <span>{commentStatusLabels[comment.status]}</span>
                    </div>
                    <p>{comment.body}</p>
                    <time dateTime={comment.createdAt.toISOString()}>
                      {formatActivityDate(comment.createdAt)}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="account-empty">还没有提交评论。</p>
            )}
          </section>
        </div>
      </main>
      <SiteFooter year={new Date().getUTCFullYear()} />
    </>
  );
}
