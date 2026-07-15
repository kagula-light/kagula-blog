"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  commentModerationAction,
  type GovernanceActionState,
} from "../../features/users/actions/user-actions";
import type { ModerationCommentItem } from "../../features/users/server/user-repository";

const initialState: GovernanceActionState = { status: "IDLE" };
const statusLabels = {
  PENDING: "待审核",
  APPROVED: "已批准",
  REJECTED: "已拒绝",
  DELETED: "已删除",
} as const;
const transitions = {
  PENDING: [
    { status: "APPROVED", label: "批准", destructive: false },
    { status: "REJECTED", label: "拒绝", destructive: true },
  ],
  APPROVED: [{ status: "DELETED", label: "删除", destructive: true }],
  REJECTED: [{ status: "DELETED", label: "删除", destructive: true }],
  DELETED: [],
} as const;

interface CommentQueueProps {
  readonly comments: readonly ModerationCommentItem[];
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function CommentQueue({ comments }: CommentQueueProps) {
  const [state, formAction, pending] = useActionState(commentModerationAction, initialState);

  if (comments.length === 0) {
    return (
      <div className="admin-empty-state">
        <strong>当前队列为空</strong>
        <p>这个状态下暂时没有评论。</p>
      </div>
    );
  }

  return (
    <>
      {state.message ? (
        <p className="admin-action-message" role={state.status === "ERROR" ? "alert" : "status"}>
          {state.message}
        </p>
      ) : null}
      <div className="admin-table-wrap">
        <table className="admin-table admin-comment-table">
          <caption className="sr-only">评论审核队列</caption>
          <thead>
            <tr>
              <th scope="col">评论</th>
              <th scope="col">文章</th>
              <th scope="col">状态</th>
              <th scope="col">提交时间</th>
              <th scope="col">操作</th>
            </tr>
          </thead>
          <tbody>
            {comments.map((comment) => (
              <tr key={comment.id}>
                <th scope="row">
                  <span className="admin-comment-body">{comment.body}</span>
                  <span className="admin-table-subtitle">{comment.authorDisplayName}</span>
                </th>
                <td>
                  <Link href={`/articles/${comment.postSlug}`} target="_blank" rel="noreferrer">
                    {comment.postTitle}
                  </Link>
                </td>
                <td>
                  <span className={`status-chip status-${comment.status.toLowerCase()}`}>
                    {statusLabels[comment.status]}
                  </span>
                </td>
                <td>{formatDate(comment.createdAt)}</td>
                <td className="admin-table-action">
                  {transitions[comment.status].length === 0 ? (
                    <span className="admin-action-note">无可用操作</span>
                  ) : (
                    <div className="admin-row-actions">
                      {transitions[comment.status].map((transition) => (
                        <form key={transition.status} action={formAction}>
                          <input type="hidden" name="commentId" value={comment.id} />
                          <input type="hidden" name="targetStatus" value={transition.status} />
                          <button
                            className={
                              transition.destructive
                                ? "admin-action-button admin-action-danger"
                                : "admin-action-button"
                            }
                            type="submit"
                            disabled={pending}
                            title={
                              transition.status === "DELETED"
                                ? "删除后评论不会公开，且不能恢复"
                                : undefined
                            }
                          >
                            {transition.label}
                          </button>
                        </form>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="admin-table-footnote">删除是不可逆的软删除操作，评论将不再公开显示。</p>
    </>
  );
}
