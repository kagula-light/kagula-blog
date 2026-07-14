import type { Metadata } from "next";

import { MediaUpload } from "../../../components/admin/media-upload";
import { createMediaRepository } from "../../../features/media/server/media-repository";
import { getDatabase } from "../../../server/database/get-database";
import { site } from "../../../data/site";

export const metadata: Metadata = { title: `媒体 | ${site.name}` };

export default async function AdminMediaPage() {
  const media = await createMediaRepository(getDatabase()).listMedia();
  return (
    <section className="admin-content-page" aria-labelledby="media-title">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">内容资源</p>
          <h1 id="media-title">媒体</h1>
          <p>上传和检查文章使用的图片资源。</p>
        </div>
      </div>
      <MediaUpload />
      <div className="admin-media-grid" aria-label="媒体资源列表">
        {media.map((asset) => (
          <article className="media-item" key={asset.id}>
            <div className="media-item-preview" aria-hidden="true">
              {asset.mimeType.split("/")[1]?.toUpperCase()}
            </div>
            <div>
              <strong>{asset.objectKey.split("/").pop()}</strong>
              <span>
                {asset.width} × {asset.height} · {asset.status}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
