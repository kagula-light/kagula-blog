"use client";

import { useActionState } from "react";

import {
  mediaUploadAction,
  type MediaActionState,
} from "../../features/media/actions/media-actions";

interface MediaUploadProps {
  readonly heading?: string;
}

const initialState: MediaActionState = { status: "IDLE" };

export function MediaUpload({ heading = "添加图片" }: MediaUploadProps) {
  const [state, formAction, pending] = useActionState(mediaUploadAction, initialState);
  return (
    <form className="media-upload" action={formAction}>
      <div>
        <p className="admin-eyebrow">资源上传</p>
        <h2>{heading}</h2>
        <p>支持 JPEG、PNG、WebP 和 AVIF，文件会在服务端验证后进入 R2。</p>
      </div>
      <label className="admin-field">
        <span>图片文件</span>
        <input
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          required
        />
      </label>
      <label className="admin-field">
        <span>替代文字</span>
        <input name="altText" maxLength={240} />
      </label>
      {state.status === "ERROR" ? (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === "SUCCESS" ? (
        <p className="form-success" role="status">
          上传完成：{state.objectKey}
        </p>
      ) : null}
      <button className="primary-button admin-link-button" disabled={pending} type="submit">
        {pending ? "验证并上传中" : "上传图片"}
      </button>
    </form>
  );
}
