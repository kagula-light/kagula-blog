"use client";

import { useActionState } from "react";

import {
  type GovernanceActionState,
  userStatusAction,
} from "../../features/users/actions/user-actions";
import type { UserListItem } from "../../features/users/server/user-repository";

const initialState: GovernanceActionState = { status: "IDLE" };
const statusLabels = { ACTIVE: "正常", MUTED: "禁言", BANNED: "封禁" } as const;
const transitions = {
  ACTIVE: [
    { status: "MUTED", label: "禁言", destructive: false },
    { status: "BANNED", label: "封禁", destructive: true },
  ],
  MUTED: [
    { status: "ACTIVE", label: "恢复", destructive: false },
    { status: "BANNED", label: "封禁", destructive: true },
  ],
  BANNED: [{ status: "ACTIVE", label: "解封", destructive: false }],
} as const;

interface UserListProps {
  readonly users: readonly UserListItem[];
}

function formatDate(value: Date | null): string {
  if (!value) return "从未登录";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function UserList({ users }: UserListProps) {
  const [state, formAction, pending] = useActionState(userStatusAction, initialState);

  if (users.length === 0) {
    return (
      <div className="admin-empty-state">
        <strong>没有符合条件的用户</strong>
        <p>调整关键词或状态筛选后重试。</p>
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
        <table className="admin-table admin-governance-table">
          <caption className="sr-only">用户治理列表</caption>
          <thead>
            <tr>
              <th scope="col">用户</th>
              <th scope="col">角色</th>
              <th scope="col">状态</th>
              <th scope="col">最近登录</th>
              <th scope="col">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <th scope="row">
                  <span className="admin-table-title">{user.displayName}</span>
                  <span className="admin-table-subtitle">@{user.username}</span>
                </th>
                <td>{user.role === "ADMIN" ? "管理员" : "用户"}</td>
                <td>
                  <span className={`status-chip status-${user.status.toLowerCase()}`}>
                    {statusLabels[user.status]}
                  </span>
                </td>
                <td>{formatDate(user.lastLoginAt)}</td>
                <td className="admin-table-action">
                  {user.role === "ADMIN" ? (
                    <span className="admin-action-note">受保护</span>
                  ) : (
                    <div className="admin-row-actions">
                      {transitions[user.status].map((transition) => (
                        <form key={transition.status} action={formAction}>
                          <input type="hidden" name="targetUserId" value={user.id} />
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
                              transition.status === "BANNED"
                                ? "封禁后该用户的现有会话会立即失效"
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
      <p className="admin-table-footnote">封禁会立即撤销该用户的全部有效会话。</p>
    </>
  );
}
