import Link from "next/link";

interface SiteFooterProps {
  readonly year: number;
}

export function SiteFooter({ year }: SiteFooterProps) {
  return (
    <footer className="site-footer">
      <div>
        <p className="site-footer-mark">神乐的无月之境</p>
        <p>神乐静无月关于编程、AI 与个人思考的长期记录。</p>
      </div>
      <nav aria-label="页脚导航">
        <Link href="/archive">文章归档</Link>
        <Link href="/feed.xml">RSS</Link>
        <Link href="/login">作者登录</Link>
      </nav>
      <small>© {year} 神乐静无月</small>
    </footer>
  );
}
