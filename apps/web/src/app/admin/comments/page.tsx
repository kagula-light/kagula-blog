import type { Metadata } from "next";

import { CommentQueue } from "../../../components/admin/comment-queue";
import { site } from "../../../data/site";
import type { ModeratedCommentStatus } from "../../../features/users/server/user-governance-service";
import { createUserRepository } from "../../../features/users/server/user-repository";
import { getDatabase } from "../../../server/database/get-database";

export const metadata: Metadata = { title: `评论审核 | ${site.name}` };

interface AdminCommentsPageProps {
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}

function readStatus(value: string | string[] | undefined): ModeratedCommentStatus | undefined {
  return value === "PENDING" || value === "APPROVED" || value === "REJECTED" || value === "DELETED"
    ? value
    : undefined;
}

export default async function AdminCommentsPage({ searchParams }: AdminCommentsPageProps) {
  const parameters = await searchParams;
  const status = readStatus(parameters.status) ?? "PENDING";
  const comments = await createUserRepository(getDatabase()).listModerationComments({ status });

  return (
    <section className="admin-content-page" aria-labelledby="comments-title">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">内容治理</p>
          <h1 id="comments-title">评论审核</h1>
          <p>所有评论审核通过后才会在文章页公开。</p>
        </div>
      </div>
      <form className="admin-filter-bar admin-filter-compact" action="/admin/comments" method="get">
        <label htmlFor="comment-status">审核状态</label>
        <select id="comment-status" name="status" defaultValue={status}>
          <option value="PENDING">待审核</option>
          <option value="APPROVED">已批准</option>
          <option value="REJECTED">已拒绝</option>
          <option value="DELETED">已删除</option>
        </select>
        <button type="submit">筛选</button>
      </form>
      <CommentQueue comments={comments} />
    </section>
  );
}
