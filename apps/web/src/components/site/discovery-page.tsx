import Link from "next/link";

import { PostStream, type PostStreamItem } from "./post-stream";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

interface DiscoveryPageProps {
  readonly title: string;
  readonly description: string;
  readonly items: readonly PostStreamItem[];
  readonly emptyMessage: string;
  readonly searchQuery?: string;
}

export function DiscoveryPage({
  title,
  description,
  items,
  emptyMessage,
  searchQuery,
}: DiscoveryPageProps) {
  return (
    <>
      <SiteHeader current="articles" />
      <main id="main-content" className="discovery-page" tabIndex={-1}>
        <nav className="article-breadcrumb" aria-label="面包屑">
          <Link href="/">首页</Link>
          <span aria-hidden="true">/</span>
          <span>{title}</span>
        </nav>
        <header className="discovery-header">
          <h1>{title}</h1>
          <p>{description}</p>
        </header>
        {searchQuery !== undefined ? (
          <form className="discovery-search" action="/search" role="search">
            <label htmlFor="discovery-query">搜索公开文章</label>
            <div>
              <input id="discovery-query" name="q" type="search" defaultValue={searchQuery} />
              <button type="submit">搜索</button>
            </div>
          </form>
        ) : null}
        <PostStream items={items} emptyMessage={emptyMessage} />
      </main>
      <SiteFooter year={new Date().getUTCFullYear()} />
    </>
  );
}
