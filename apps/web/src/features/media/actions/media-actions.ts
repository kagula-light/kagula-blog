"use server";

import { randomUUID } from "node:crypto";

import { getCurrentSession } from "../../../server/auth/get-current-session";
import { getServerEnv } from "../../../server/config/env";
import { getDatabase } from "../../../server/database/get-database";
import { createR2ObjectStorage } from "../../../server/storage/r2-object-storage";
import { validateImageUpload } from "../domain/image-validation";
import { createMediaRepository } from "../server/media-repository";
import { createMediaService } from "../server/media-service";

export interface MediaActionState {
  readonly status: "IDLE" | "SUCCESS" | "ERROR";
  readonly message?: string;
  readonly mediaId?: string;
  readonly objectKey?: string;
}

export async function mediaUploadAction(
  _previousState: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  const entry = formData.get("file");
  if (!(entry instanceof File) || entry.size === 0) {
    return { status: "ERROR", message: "请选择图片文件" };
  }

  const session = await getCurrentSession();
  if (!session) return { status: "ERROR", message: "请先登录管理员账号" };

  const env = getServerEnv();
  const repository = createMediaRepository(getDatabase());
  const storage = createR2ObjectStorage({
    endpoint: env.R2_ENDPOINT,
    region: env.R2_REGION,
    bucket: env.R2_BUCKET,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    forcePathStyle: env.R2_FORCE_PATH_STYLE,
  });
  const service = createMediaService({
    ...repository,
    validateImage: validateImageUpload,
    issueId: randomUUID,
    clock: () => new Date(),
    objectStorage: storage,
    maximumBytes: env.MEDIA_MAX_BYTES,
    maximumDimension: env.MEDIA_MAX_DIMENSION,
  });

  try {
    const result = await service.upload(session, {
      bytes: Buffer.from(await entry.arrayBuffer()),
      declaredMimeType: entry.type,
      altText: (() => {
        const altEntry = formData.get("altText");
        return typeof altEntry === "string" ? altEntry : null;
      })(),
    });
    return { status: "SUCCESS", mediaId: result.id, objectKey: result.objectKey };
  } catch {
    return { status: "ERROR", message: "图片上传失败，请检查文件后重试" };
  }
}
