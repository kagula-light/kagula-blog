"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";

import {
  commentAction,
  type CommentActionState,
} from "../../features/comments/actions/comment-actions";

const initialState: CommentActionState = { status: "IDLE" };

interface CommentFormProps {
  readonly postId: string;
  readonly loginHref: string;
}

export function CommentForm({ postId, loginHref }: CommentFormProps) {
  const [state, formAction, pending] = useActionState(commentAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const countRef = useRef<HTMLOutputElement>(null);
  const bodyError = state.fieldErrors?.body?.[0];

  useEffect(() => {
    if (state.status === "SUCCESS") {
      formRef.current?.reset();
      if (countRef.current) countRef.current.textContent = "0 / 2000";
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="comment-form" noValidate>
      <input type="hidden" name="postId" value={postId} />
      <label htmlFor={`comment-body-${postId}`}>发表评论</label>
      <textarea
        id={`comment-body-${postId}`}
        name="body"
        rows={5}
        maxLength={2000}
        aria-invalid={bodyError ? true : undefined}
        aria-describedby={
          bodyError ? "comment-body-count comment-body-error" : "comment-body-count"
        }
        onChange={(event) => {
          if (countRef.current) {
            countRef.current.textContent = `${[...event.currentTarget.value].length} / 2000`;
          }
        }}
        disabled={pending}
        required
      />
      <div className="comment-form-footer">
        <output ref={countRef} id="comment-body-count" htmlFor={`comment-body-${postId}`}>
          0 / 2000
        </output>
        <button type="submit" disabled={pending}>
          {pending ? "正在提交" : "提交评论"}
        </button>
      </div>
      {bodyError ? (
        <p id="comment-body-error" className="form-error">
          {bodyError}
        </p>
      ) : null}
      {state.message ? (
        <p role={state.status === "ERROR" ? "alert" : "status"} className="comment-form-message">
          {state.message}
          {state.status === "ERROR" && state.message.startsWith("登录后") ? (
            <>
              {" "}
              <Link href={loginHref}>前往登录</Link>
            </>
          ) : null}
        </p>
      ) : null}
    </form>
  );
}
