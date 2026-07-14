import { createPublicPostRepository } from "../features/posts/server/public-post-repository";
import { getPublicPostCoverUrl } from "../features/posts/server/public-post-presenter";
import { getServerEnv } from "../server/config/env";
import { getDatabase } from "../server/database/get-database";
import { FeaturedPost } from "../components/site/featured-post";
import { PostStream, type PostStreamItem } from "../components/site/post-stream";
import { SiteFooter } from "../components/site/site-footer";
import { SiteHeader } from "../components/site/site-header";
import { WelcomeScene } from "../components/site/welcome-scene";
import Link from "next/link";

export const dynamic = "force-dynamic";

function postStreamItem(
  post: Awaited<ReturnType<ReturnType<typeof createPublicPostRepository>["listPublished"]>>[number],
  publicAssetBaseUrl: string,
): PostStreamItem {
  return {
    post,
    coverUrl: getPublicPostCoverUrl(post, publicAssetBaseUrl),
  };
}

export default async function HomePage() {
  const repository = createPublicPostRepository(getDatabase());
  const posts = await repository.listPublished(16);
  const publicAssetBaseUrl = getServerEnv().R2_PUBLIC_BASE_URL;
  const [featured, ...recent] = posts;
  const categories = [
    ...new Map(posts.map((post) => [post.category.slug, post.category])).values(),
  ].slice(0, 6);

  return (
    <>
      <WelcomeScene mainContentId="main-content" />
      <SiteHeader current="home" />
      <main id="main-content" className="public-main" tabIndex={-1}>
        <section className="library-intro" aria-labelledby="library-title">
          <div>
            <p className="library-kicker">神乐静无月的私人星图书库</p>
            <h1 id="library-title">在深夜，记录技术与仍未命名的思绪</h1>
            <p>
              这里收录编程、AI、开发实践与偶尔偏离轨道的个人随笔。没有信息流竞速，只有可以慢慢读完的章节。
            </p>
          </div>
          <form className="library-search" action="/search" role="search">
            <label htmlFor="home-search">在书库中寻找</label>
            <div>
              <input id="home-search" name="q" type="search" placeholder="文章标题、主题或关键词" />
              <button type="submit">搜索</button>
            </div>
            {categories.length > 0 ? (
              <nav aria-label="热门分类">
                {categories.map((category) => (
                  <Link key={category.slug} href={`/categories/${category.slug}`}>
                    {category.name}
                  </Link>
                ))}
              </nav>
            ) : null}
          </form>
        </section>

        <section className="public-section" aria-labelledby="featured-title">
          <div className="section-heading">
            <div>
              <p>从这里开始</p>
              <h2 id="featured-title">最新公开章节</h2>
            </div>
            <Link href="/archive">查看全部文章</Link>
          </div>
          {featured ? (
            <FeaturedPost
              post={featured}
              coverUrl={postStreamItem(featured, publicAssetBaseUrl).coverUrl}
            />
          ) : (
            <PostStream items={[]} />
          )}
        </section>

        {recent.length > 0 ? (
          <section className="public-section public-section-stream" aria-labelledby="recent-title">
            <div className="section-heading">
              <div>
                <p>沿着星轨继续</p>
                <h2 id="recent-title">最近发布</h2>
              </div>
            </div>
            <PostStream items={recent.map((post) => postStreamItem(post, publicAssetBaseUrl))} />
          </section>
        ) : null}

        <section className="hotspot-passage" aria-labelledby="hotspot-title">
          <div>
            <p>每日热点</p>
            <h2 id="hotspot-title">把喧闹留在门外，只带回值得读的线索</h2>
          </div>
          <p>热点候选将经过自动采集与人工审核后公开。功能上线前，这里不会展示未经核验的榜单。</p>
          <Link href="/hotspots">前往热榜</Link>
        </section>
      </main>
      <SiteFooter year={new Date().getUTCFullYear()} />
    </>
  );
}
