import type { PostListItem } from "../../features/posts/server/post-repository";

const statusLabels = {
  DRAFT: "草稿",
  SCHEDULED: "已排期",
  PUBLISHED: "已发布",
  ARCHIVED: "已归档",
} as const;

interface PostListProps {
  readonly posts: readonly PostListItem[];
}

export function PostList({ posts }: PostListProps) {
  if (posts.length === 0) {
    return (
      <div className="admin-empty-state">
        <strong>还没有文章</strong>
        <p>创建第一篇 Markdown 文章，建立你的内容档案。</p>
      </div>
    );
  }

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <caption className="sr-only">文章列表</caption>
        <thead>
          <tr>
            <th scope="col">文章</th>
            <th scope="col">状态</th>
            <th scope="col">版本</th>
            <th scope="col">最近更新</th>
            <th scope="col">
              <span className="sr-only">操作</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr key={post.id}>
              <th scope="row">
                <a className="admin-table-title" href={`/admin/posts/${post.id}/edit`}>
                  {post.title}
                </a>
                <span className="admin-table-subtitle">/{post.slug}</span>
              </th>
              <td>
                <span className={`status-chip status-${post.status.toLowerCase()}`}>
                  {statusLabels[post.status]}
                </span>
              </td>
              <td>v{post.version}</td>
              <td>{post.updatedAt.toLocaleString("zh-CN", { dateStyle: "medium" })}</td>
              <td className="admin-table-action">
                <a href={`/admin/posts/${post.id}/preview`}>预览</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
