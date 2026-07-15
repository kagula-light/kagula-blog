import type { ApprovedComment } from "../../features/comments/server/comment-repository";

interface CommentListProps {
  readonly comments: readonly ApprovedComment[];
}

function formatCommentDate(value: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function CommentList({ comments }: CommentListProps) {
  if (comments.length === 0) {
    return <p className="comment-empty">还没有通过审核的评论。</p>;
  }

  return (
    <ol className="comment-list">
      {comments.map((comment) => (
        <li key={comment.id}>
          <header>
            <strong>{comment.authorDisplayName}</strong>
            <time dateTime={comment.createdAt.toISOString()}>
              {formatCommentDate(comment.createdAt)}
            </time>
          </header>
          <p>{comment.body}</p>
        </li>
      ))}
    </ol>
  );
}
