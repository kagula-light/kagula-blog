import { site } from "../data/site";

export default function HomePage() {
  return (
    <main className="foundation-shell">
      <header className="foundation-header">
        <h1 className="foundation-brand">{site.name}</h1>
        <p className="foundation-author">{site.author}</p>
      </header>

      <section className="foundation-content" aria-labelledby="foundation-title">
        <p className="foundation-status">工程基础已建立</p>
        <h2 id="foundation-title" className="foundation-title">
          无月之境，正在构筑
        </h2>
        <p className="foundation-copy">
          当前页面用于确认服务端渲染、运行时配置和健康检查链路。完整的文章体验、每日热点、用户系统与原创角色视觉将在后续阶段实现。
        </p>
        <div className="foundation-lights" aria-hidden="true">
          <span className="foundation-light" />
          <span className="foundation-light" />
          <span className="foundation-light" />
        </div>
      </section>
    </main>
  );
}
