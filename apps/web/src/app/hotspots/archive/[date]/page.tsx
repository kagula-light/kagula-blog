import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { HotspotList } from "../../../../components/hotspot/hotspot-list";
import { SiteFooter } from "../../../../components/site/site-footer";
import { SiteHeader } from "../../../../components/site/site-header";
import { site } from "../../../../data/site";
import { parseHotspotArchiveDate } from "../../../../features/hotspots/server/hotspot-archive-date";
import { createHotspotRepository } from "../../../../features/hotspots/server/hotspot-repository";
import { getDatabase } from "../../../../server/database/get-database";

interface HotspotArchivePageProps {
  readonly params: Promise<Readonly<{ date: string }>>;
}

export async function generateMetadata({ params }: HotspotArchivePageProps): Promise<Metadata> {
  const { date } = await params;
  return { title: `${date} 热点归档 | ${site.name}` };
}

export default async function HotspotArchivePage({ params }: HotspotArchivePageProps) {
  const parsedDate = parseHotspotArchiveDate((await params).date);
  if (!parsedDate) notFound();
  const archive = await createHotspotRepository(getDatabase()).findArchive(parsedDate);
  if (!archive) notFound();
  const items = archive.items.map((item) => ({
    id: item.candidateId ?? `${archive.archiveDate}:${item.position}`,
    sourceCode: item.sourceCode,
    sourceName: item.sourceName,
    title: item.title,
    url: item.url,
    sourceRank: item.sourceRank,
    sourceScore: null,
    sourceCategory: null,
    publicOrder: item.position,
    capturedAt: item.capturedAt,
  }));

  return (
    <>
      <SiteHeader current="hotspots" />
      <main id="main-content" className="discovery-page" tabIndex={-1}>
        <nav className="article-breadcrumb" aria-label="面包屑">
          <Link href="/">首页</Link>
          <span aria-hidden="true">/</span>
          <Link href="/hotspots">每日热点</Link>
          <span aria-hidden="true">/</span>
          <span>{archive.archiveDate}</span>
        </nav>
        <header className="discovery-header hotspot-archive-header">
          <p className="hotspot-page-date">北京时间归档</p>
          <h1>{archive.archiveDate}</h1>
          <p>这份快照包含归档时已经审核并公开的 {archive.itemCount} 条线索。</p>
        </header>
        <HotspotList
          items={items}
          emptyTitle="这一天没有公开热点"
          emptyDescription="归档任务已完成，但当日没有符合公开条件的条目。"
        />
      </main>
      <SiteFooter year={new Date().getUTCFullYear()} />
    </>
  );
}
