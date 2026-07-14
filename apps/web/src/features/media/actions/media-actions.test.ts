import { beforeEach, describe, expect, it, vi } from "vitest";

import { mediaUploadAction } from "./media-actions";
import type { MediaActionState } from "./media-actions";

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  upload: vi.fn(),
}));

vi.mock("../../../server/auth/get-current-session", () => ({
  getCurrentSession: mocks.getCurrentSession,
}));
vi.mock("../../../server/database/get-database", () => ({
  getDatabase: vi.fn(() => ({ kind: "database" })),
}));
vi.mock("../../../server/config/env", () => ({
  getServerEnv: vi.fn(() => ({
    R2_ENDPOINT: "https://r2.example.com",
    R2_REGION: "auto",
    R2_BUCKET: "kagura-assets",
    R2_PUBLIC_BASE_URL: "https://assets.example.com",
    R2_ACCESS_KEY_ID: "test-access-key",
    R2_SECRET_ACCESS_KEY: "test-secret-key",
    R2_FORCE_PATH_STYLE: false,
    MEDIA_MAX_BYTES: 10_485_760,
    MEDIA_MAX_DIMENSION: 8_192,
  })),
}));
vi.mock("../server/media-repository", () => ({
  createMediaRepository: vi.fn(() => ({
    createPending: vi.fn(),
    markReady: vi.fn(),
    recordFailure: vi.fn(),
  })),
}));
vi.mock("../server/media-service", async (importOriginal) => {
  const original = await importOriginal<typeof import("../server/media-service")>();
  return {
    ...original,
    createMediaService: vi.fn(() => ({ upload: mocks.upload })),
  };
});
vi.mock("../domain/image-validation", () => ({
  validateImageUpload: vi.fn(),
}));
vi.mock("../../../server/storage/r2-object-storage", () => ({
  createR2ObjectStorage: vi.fn(() => ({ putObject: vi.fn(), deleteObject: vi.fn() })),
}));

const initialState: MediaActionState = { status: "IDLE" };

function createMediaForm(file?: File): FormData {
  const formData = new FormData();
  if (file) formData.set("file", file);
  formData.set("altText", "Article cover");
  return formData;
}

describe("mediaUploadAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentSession.mockResolvedValue({
      id: "admin-id",
      role: "ADMIN",
      status: "ACTIVE",
    });
    mocks.upload.mockResolvedValue({
      id: "media-id",
      objectKey: "media/2026/07/image.png",
      status: "READY",
    });
  });

  it("rejects a missing file before service construction", async () => {
    await expect(mediaUploadAction(initialState, createMediaForm())).resolves.toEqual({
      status: "ERROR",
      message: "请选择图片文件",
    });
    expect(mocks.getCurrentSession).not.toHaveBeenCalled();
  });

  it("uploads a File through the media service", async () => {
    const file = new File([Buffer.from("image")], "cover.png", { type: "image/png" });

    await expect(mediaUploadAction(initialState, createMediaForm(file))).resolves.toEqual({
      status: "SUCCESS",
      mediaId: "media-id",
      objectKey: "media/2026/07/image.png",
    });
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.objectContaining({ id: "admin-id", role: "ADMIN" }),
      { bytes: expect.any(Buffer), declaredMimeType: "image/png", altText: "Article cover" },
    );
  });

  it("returns a generic error when storage fails", async () => {
    mocks.upload.mockRejectedValue(new Error("secret R2 response"));
    const file = new File([Buffer.from("image")], "cover.png", { type: "image/png" });

    await expect(mediaUploadAction(initialState, createMediaForm(file))).resolves.toEqual({
      status: "ERROR",
      message: "图片上传失败，请检查文件后重试",
    });
  });
});
