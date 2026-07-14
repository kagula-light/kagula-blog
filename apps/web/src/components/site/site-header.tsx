import Link from "next/link";

type PublicSection = "home" | "articles" | "archive" | "hotspots";

interface SiteHeaderProps {
  readonly current?: PublicSection;
}

const navigation = [
  { href: "/", label: "首页", section: "home" },
  { href: "/archive", label: "文章", section: "articles" },
  { href: "/hotspots", label: "今日热榜", section: "hotspots" },
  { href: "/archive", label: "归档", section: "archive" },
] as const;

export function SiteHeader({ current }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="site-wordmark" href="/" aria-label="神乐的无月之境首页">
          <span aria-hidden="true">静</span>
          <strong>神乐的无月之境</strong>
        </Link>
        <nav className="site-navigation" aria-label="主导航">
          {navigation.map((item) => (
            <Link
              key={`${item.section}-${item.href}`}
              href={item.href}
              aria-current={current === item.section ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="site-header-actions">
          <Link className="site-search-link" href="/search">
            搜索
          </Link>
          <Link className="site-login-link" href="/login">
            登录
          </Link>
        </div>
      </div>
    </header>
  );
}
