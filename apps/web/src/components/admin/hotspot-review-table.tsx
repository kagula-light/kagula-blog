"use client";

import { useActionState } from "react";

import {
  hotspotReviewAction,
  type HotspotActionState,
} from "../../features/hotspots/actions/hotspot-actions";
import type { HotspotReviewCandidate } from "../../features/hotspots/server/hotspot-repository";

const initialState: HotspotActionState = { status: "IDLE" };
const statusLabels = {
  PENDING: "待审核",
  APPROVED: "已公开",
  REJECTED: "已拒绝",
  EXPIRED: "已过期",
} as const;

interface HotspotReviewTableProps {
  readonly candidates: readonly HotspotReviewCandidate[];
}

interface SourceHealthProps {
  readonly candidate: HotspotReviewCandidate;
}

function formatDate(value: Date | null): string {
  if (!value) return "暂无";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

function SourceHealth({ candidate }: SourceHealthProps) {
  if (candidate.sourceConsecutiveFailures > 0) {
    return (
      <span className="admin-source-health admin-source-health-error">
        连续失败 {candidate.sourceConsecutiveFailures} 次
      </span>
    );
  }
  if (!candidate.sourceLastSuccessAt) {
    return <span className="admin-source-health">等待首次采集</span>;
  }
  return (
    <span className="admin-source-health">
      最近成功 {formatDate(candidate.sourceLastSuccessAt)}
    </span>
  );
}

export function HotspotReviewTable({ candidates }: HotspotReviewTableProps) {
  const [state, formAction, pending] = useActionState(hotspotReviewAction, initialState);

  if (candidates.length === 0) {
    return (
      <div className="admin-empty-state">
        <strong>当前队列为空</strong>
        <p>这个筛选条件下没有热点候选。</p>
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
        <table className="admin-table admin-hotspot-table">
          <caption className="sr-only">热点审核队列</caption>
          <thead>
            <tr>
              <th scope="col">候选</th>
              <th scope="col">来源</th>
              <th scope="col">状态</th>
              <th scope="col">采集时间</th>
              <th scope="col">审核与排序</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => (
              <tr key={candidate.id}>
                <th scope="row">
                  <a
                    className="admin-table-title"
                    href={candidate.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {candidate.originalTitle}
                  </a>
                  <span className="admin-table-subtitle">
                    来源排名 {candidate.sourceRank}
                    {candidate.sourceScore === null ? "" : ` · 热度 ${candidate.sourceScore}`}
                  </span>
                </th>
                <td>
                  <span className="admin-table-title">{candidate.sourceName}</span>
                  <SourceHealth candidate={candidate} />
                  {candidate.sourceLastError ? (
                    <span className="admin-source-error" title={candidate.sourceLastError}>
                      {candidate.sourceLastError}
                    </span>
                  ) : null}
                </td>
                <td>
                  <span className={`status-chip status-${candidate.status.toLowerCase()}`}>
                    {statusLabels[candidate.status]}
                  </span>
                </td>
                <td>{formatDate(candidate.capturedAt)}</td>
                <td className="admin-table-action">
                  {candidate.status === "PENDING" || candidate.status === "APPROVED" ? (
                    <div className="admin-hotspot-actions">
                      <form action={formAction} className="admin-hotspot-public-form">
                        <input type="hidden" name="candidateId" value={candidate.id} />
                        <input
                          type="hidden"
                          name="operation"
                          value={candidate.status === "PENDING" ? "APPROVE" : "REORDER"}
                        />
                        <label>
                          <span className="sr-only">公开标题</span>
                          <input
                            name="displayTitle"
                            defaultValue={candidate.displayTitle}
                            maxLength={180}
                            required
                            aria-label={`${candidate.originalTitle}的公开标题`}
                          />
                        </label>
                        <label>
                          <span className="sr-only">公开顺序</span>
                          <input
                            className="admin-order-input"
                            name="publicOrder"
                            type="number"
                            defaultValue={candidate.publicOrder ?? candidate.sourceRank}
                            min={1}
                            max={1000}
                            required
                            aria-label={`${candidate.originalTitle}的公开顺序`}
                          />
                        </label>
                        <button className="admin-action-button" type="submit" disabled={pending}>
                          {candidate.status === "PENDING" ? "批准" : "保存"}
                        </button>
                      </form>
                      <form action={formAction}>
                        <input type="hidden" name="candidateId" value={candidate.id} />
                        <input
                          type="hidden"
                          name="operation"
                          value={candidate.status === "PENDING" ? "REJECT" : "EXPIRE"}
                        />
                        <button
                          className="admin-action-button admin-action-danger"
                          type="submit"
                          disabled={pending}
                        >
                          {candidate.status === "PENDING" ? "拒绝" : "过期"}
                        </button>
                      </form>
                    </div>
                  ) : (
                    <span className="admin-action-note">无可用操作</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
