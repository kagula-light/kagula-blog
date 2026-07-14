import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "../../components/site/site-footer";
import { SiteHeader } from "../../components/site/site-header";
import { site } from "../../data/site";

export const metadata: Metadata = { title: `每日热点 | ${site.name}` };

export default function HotspotsPage() {
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
          <h1>每日热点</h1>
          <p>
            自动采集、人工审核、按北京时间归档。审核流水线完成前，这里不会展示未经确认的第三方榜单。
          </p>
        </header>
        <div className="public-empty-state">
          <strong>热榜正在接入</strong>
          <p>来源适配器和后台审核完成后，公开结果会出现在这里。</p>
        </div>
      </main>
      <SiteFooter year={new Date().getUTCFullYear()} />
    </>
  );
}
