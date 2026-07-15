import type { Metadata } from "next";

import { HotspotReviewTable } from "../../../components/admin/hotspot-review-table";
import { site } from "../../../data/site";
import {
  createHotspotRepository,
  type HotspotReviewFilter,
} from "../../../features/hotspots/server/hotspot-repository";
import type { HotspotCandidateStatus } from "../../../features/hotspots/server/hotspot-review-service";
import { getDatabase } from "../../../server/database/get-database";

export const metadata: Metadata = { title: `热点审核 | ${site.name}` };

interface AdminHotspotsPageProps {
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}

const sourceOptions = [
  ["GITHUB_TRENDING", "GitHub Trending"],
  ["HACKER_NEWS", "Hacker News"],
  ["BILIBILI", "哔哩哔哩"],
  ["WEIBO", "微博热搜"],
  ["BAIDU", "百度热搜"],
] as const;

function readStatus(value: string | string[] | undefined): HotspotCandidateStatus | undefined {
  return value === "PENDING" || value === "APPROVED" || value === "REJECTED" || value === "EXPIRED"
    ? value
    : undefined;
}

function readSource(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && sourceOptions.some(([code]) => code === value)
    ? value
    : undefined;
}

export default async function AdminHotspotsPage({ searchParams }: AdminHotspotsPageProps) {
  const parameters = await searchParams;
  const status = readStatus(parameters.status) ?? "PENDING";
  const sourceCode = readSource(parameters.source);
  const filter: HotspotReviewFilter = {
    status,
    ...(sourceCode ? { sourceCode } : {}),
  };
  const candidates = await createHotspotRepository(getDatabase()).listReviewCandidates(filter);

  return (
    <section className="admin-content-page" aria-labelledby="hotspots-admin-title">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">内容筛选</p>
          <h1 id="hotspots-admin-title">热点审核</h1>
          <p>检查自动采集候选，设置公开标题与顺序。</p>
        </div>
      </div>
      <form className="admin-filter-bar admin-hotspot-filter" action="/admin/hotspots" method="get">
        <label htmlFor="hotspot-source">来源</label>
        <select id="hotspot-source" name="source" defaultValue={sourceCode ?? ""}>
          <option value="">全部来源</option>
          {sourceOptions.map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
        <label htmlFor="hotspot-status">状态</label>
        <select id="hotspot-status" name="status" defaultValue={status}>
          <option value="PENDING">待审核</option>
          <option value="APPROVED">已公开</option>
          <option value="REJECTED">已拒绝</option>
          <option value="EXPIRED">已过期</option>
        </select>
        <button type="submit">筛选</button>
      </form>
      <HotspotReviewTable candidates={candidates} />
    </section>
  );
}
