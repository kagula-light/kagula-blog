import type { Metadata } from "next";
import Link from "next/link";

import { HotspotList } from "../../components/hotspot/hotspot-list";
import { SiteFooter } from "../../components/site/site-footer";
import { SiteHeader } from "../../components/site/site-header";
import { site } from "../../data/site";
import { createHotspotRepository } from "../../features/hotspots/server/hotspot-repository";
import { getDatabase } from "../../server/database/get-database";

export const metadata: Metadata = { title: `每日热点 | ${site.name}` };
export const dynamic = "force-dynamic";

export default async function HotspotsPage() {
  const now = new Date();
  const repository = createHotspotRepository(getDatabase());
  const [items, archives] = await Promise.all([
    repository.listCurrentPublic(now),
    repository.listRecentArchives(14),
  ]);

  return (
    <>
      <SiteHeader current="hotspots" />
      <main id="main-content" className="discovery-page" tabIndex={-1}>
        <nav className="article-breadcrumb" aria-label="面包屑">
          <Link href="/">首页</Link>
          <span aria-hidden="true">/</span>
          <span>每日热点</span>
        </nav>
        <header className="discovery-header">
          <p className="hotspot-page-date">
            {new Intl.DateTimeFormat("zh-CN", {
              timeZone: "Asia/Shanghai",
              dateStyle: "long",
            }).format(now)}
          </p>
          <h1>每日热点</h1>
          <p>从五个公开来源带回线索，只展示经过人工审核且仍在有效期内的条目。</p>
        </header>
        <HotspotList items={items} />
        {archives.length > 0 ? (
          <nav className="hotspot-archive-nav" aria-labelledby="hotspot-archive-title">
            <div>
              <p>历史快照</p>
              <h2 id="hotspot-archive-title">往日归档</h2>
            </div>
            <ol>
              {archives.map((archive) => (
                <li key={archive.archiveDate}>
                  <Link href={`/hotspots/archive/${archive.archiveDate}`}>
                    <time dateTime={archive.archiveDate}>{archive.archiveDate}</time>
                    <span>{archive.itemCount} 条</span>
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
      </main>
      <SiteFooter year={new Date().getUTCFullYear()} />
    </>
  );
}
