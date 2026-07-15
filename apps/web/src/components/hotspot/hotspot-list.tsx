import type { PublicHotspotItem } from "../../features/hotspots/server/hotspot-repository";

interface HotspotListProps {
  readonly items: readonly PublicHotspotItem[];
  readonly variant?: "full" | "preview";
  readonly emptyTitle?: string;
  readonly emptyDescription?: string;
}

function formatCapturedAt(value: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}

export function HotspotList({
  items,
  variant = "full",
  emptyTitle = "今天还没有公开热点",
  emptyDescription = "候选仍在采集或审核中。",
}: HotspotListProps) {
  if (items.length === 0) {
    return (
      <div className="public-empty-state hotspot-empty-state">
        <strong>{emptyTitle}</strong>
        <p>{emptyDescription}</p>
      </div>
    );
  }

  if (variant === "preview") {
    return (
      <ol className="hotspot-preview-list">
        {items.map((item) => (
          <li key={item.id}>
            <span>{item.publicOrder.toString().padStart(2, "0")}</span>
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              {item.title}
            </a>
            <small>{item.sourceName}</small>
          </li>
        ))}
      </ol>
    );
  }

  const groups = new Map<string, { name: string; items: PublicHotspotItem[] }>();
  for (const item of items) {
    const group = groups.get(item.sourceCode);
    if (group) group.items.push(item);
    else groups.set(item.sourceCode, { name: item.sourceName, items: [item] });
  }

  return (
    <div className="hotspot-source-groups">
      {[...groups.entries()].map(([sourceCode, group]) => (
        <section
          key={sourceCode}
          className="hotspot-source-group"
          aria-labelledby={`source-${sourceCode}`}
        >
          <header>
            <p>来源</p>
            <h2 id={`source-${sourceCode}`}>{group.name}</h2>
            <span>{group.items.length.toString().padStart(2, "0")} 条</span>
          </header>
          <ol>
            {group.items.map((item) => (
              <li key={item.id}>
                <span className="hotspot-public-order" aria-label={`公开顺序 ${item.publicOrder}`}>
                  {item.publicOrder.toString().padStart(2, "0")}
                </span>
                <div>
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    {item.title}
                  </a>
                  <p>
                    <span>来源排名 {item.sourceRank}</span>
                    {item.sourceCategory ? <span>{item.sourceCategory}</span> : null}
                    <time dateTime={item.capturedAt.toISOString()}>
                      采集于 {formatCapturedAt(item.capturedAt)}
                    </time>
                  </p>
                </div>
                <span className="hotspot-external-mark" aria-hidden="true">
                  ↗
                </span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
