"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  reactionAction,
  type ReactionActionState,
} from "../../features/reactions/actions/reaction-actions";
import type { ReactionSummary } from "../../features/reactions/server/reaction-repository";

const initialState: ReactionActionState = { status: "IDLE" };

interface PostActionsProps {
  readonly postId: string;
  readonly initialSummary: ReactionSummary;
  readonly loginHref: string;
}

export function PostActions({ postId, initialSummary, loginHref }: PostActionsProps) {
  const [state, formAction, pending] = useActionState(reactionAction, initialState);
  const likeChanged =
    state.status === "SUCCESS" && (state.command === "LIKE" || state.command === "UNLIKE");
  const favoriteChanged =
    state.status === "SUCCESS" && (state.command === "FAVORITE" || state.command === "UNFAVORITE");
  const liked = likeChanged ? Boolean(state.active) : initialSummary.liked;
  const favorited = favoriteChanged ? Boolean(state.active) : initialSummary.favorited;
  const likeCount = likeChanged
    ? (state.count ?? initialSummary.likeCount)
    : initialSummary.likeCount;
  const favoriteCount = favoriteChanged
    ? (state.count ?? initialSummary.favoriteCount)
    : initialSummary.favoriteCount;

  return (
    <section className="post-actions" aria-label="文章互动">
      <div>
        <form action={formAction}>
          <input type="hidden" name="postId" value={postId} />
          <input type="hidden" name="command" value={liked ? "UNLIKE" : "LIKE"} />
          <button type="submit" aria-pressed={liked} disabled={pending}>
            <span>{liked ? "已点赞" : "点赞"}</span>
            <strong aria-label={`${likeCount} 个赞`}>{likeCount}</strong>
          </button>
        </form>
        <form action={formAction}>
          <input type="hidden" name="postId" value={postId} />
          <input type="hidden" name="command" value={favorited ? "UNFAVORITE" : "FAVORITE"} />
          <button type="submit" aria-pressed={favorited} disabled={pending}>
            <span>{favorited ? "已收藏" : "收藏"}</span>
            <strong aria-label={`${favoriteCount} 次收藏`}>{favoriteCount}</strong>
          </button>
        </form>
      </div>
      {state.status === "ERROR" ? (
        <p role="alert">
          {state.message}
          {state.message?.startsWith("登录后") ? (
            <>
              {" "}
              <Link href={loginHref}>前往登录</Link>
            </>
          ) : null}
        </p>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {state.status === "SUCCESS"
          ? `${state.command === "LIKE" || state.command === "UNLIKE" ? "点赞" : "收藏"}状态已更新`
          : ""}
      </p>
    </section>
  );
}
