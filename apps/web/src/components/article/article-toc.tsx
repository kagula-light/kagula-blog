import type { HeadingOutlineItem } from "../../features/posts/server/markdown";

type ArticleTocVariant = "desktop" | "mobile" | "both";

interface ArticleTocProps {
  readonly items: readonly HeadingOutlineItem[];
  readonly variant?: ArticleTocVariant;
}

function TocLinks({ items }: Pick<ArticleTocProps, "items">) {
  return (
    <ol>
      {items.map((item) => (
        <li key={item.id} className={`article-toc-level-${item.level}`}>
          <a href={`#${item.id}`}>{item.text}</a>
        </li>
      ))}
    </ol>
  );
}

export function ArticleToc({ items, variant = "both" }: ArticleTocProps) {
  if (items.length === 0) return null;

  return (
    <>
      {variant !== "mobile" ? (
        <aside className="article-toc-desktop" aria-label="文章目录">
          <p>本章目录</p>
          <TocLinks items={items} />
        </aside>
      ) : null}
      {variant !== "desktop" ? (
        <details className="article-toc-mobile">
          <summary>展开本章目录</summary>
          <nav aria-label="移动端文章目录">
            <TocLinks items={items} />
          </nav>
        </details>
      ) : null}
    </>
  );
}
