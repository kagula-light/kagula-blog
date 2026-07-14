import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PermissionIdentity } from "../../../server/permissions/policy";
import type { ValidatedImage } from "../domain/image-validation";
import { createMediaService, type MediaServiceDependencies } from "./media-service";

const now = new Date("2026-07-14T04:00:00.000Z");
const activeAdmin: PermissionIdentity = { id: "admin-id", role: "ADMIN", status: "ACTIVE" };
const validatedImage: ValidatedImage = {
  mimeType: "image/png",
  extension: "png",
  byteSize: 128,
  width: 16,
  height: 16,
  checksumSha256: "a".repeat(64),
};

function createDependencies(
  overrides: Partial<MediaServiceDependencies> = {},
): MediaServiceDependencies {
  return {
    validateImage: vi.fn(async () => validatedImage),
    issueId: () => "0190f3c2-5710-7aca-b167-8f4b28ad77c1",
    clock: () => now,
    createPending: vi.fn(async (input) => ({
      id: "media-id",
      ...input,
      status: "PENDING" as const,
    })),
    markReady: vi.fn(async () => undefined),
    recordFailure: vi.fn(async () => undefined),
    objectStorage: {
      putObject: vi.fn(async () => undefined),
      deleteObject: vi.fn(async () => undefined),
    },
    maximumBytes: 10_485_760,
    maximumDimension: 8_192,
    ...overrides,
  };
}

describe("media service", () => {
  beforeEach(() => vi.restoreAllMocks());

  it.each<PermissionIdentity | null>([
    null,
    { id: "user-id", role: "USER", status: "ACTIVE" },
    { id: "admin-id", role: "ADMIN", status: "BANNED" },
    { id: "admin-id", role: "ADMIN", status: "MUTED" },
  ])("rejects uploads from %j before reading image data", async (actor) => {
    const dependencies = createDependencies();
    const service = createMediaService(dependencies);

    await expect(
      service.upload(actor, {
        bytes: Buffer.from("not read"),
        declaredMimeType: "image/png",
        altText: null,
      }),
    ).rejects.toThrow(/active administrator/i);
    expect(dependencies.validateImage).not.toHaveBeenCalled();
  });

  it("moves a validated upload from pending to ready", async () => {
    const dependencies = createDependencies();
    const service = createMediaService(dependencies);
    const bytes = Buffer.from("validated bytes");

    await expect(
      service.upload(activeAdmin, {
        bytes,
        declaredMimeType: "image/png",
        altText: "  Article cover  ",
      }),
    ).resolves.toMatchObject({
      id: "media-id",
      objectKey: "media/2026/07/0190f3c2-5710-7aca-b167-8f4b28ad77c1.png",
      status: "READY",
      altText: "Article cover",
    });
    expect(dependencies.validateImage).toHaveBeenCalledWith({
      bytes,
      declaredMimeType: "image/png",
      maximumBytes: 10_485_760,
      maximumDimension: 8_192,
    });
    expect(dependencies.createPending).toHaveBeenCalledWith({
      ownerUserId: "admin-id",
      objectKey: "media/2026/07/0190f3c2-5710-7aca-b167-8f4b28ad77c1.png",
      ...validatedImage,
      altText: "Article cover",
      createdAt: now,
    });
    expect(dependencies.objectStorage.putObject).toHaveBeenCalledWith({
      key: "media/2026/07/0190f3c2-5710-7aca-b167-8f4b28ad77c1.png",
      body: bytes,
      contentType: "image/png",
      checksumSha256: "a".repeat(64),
    });
    expect(dependencies.markReady).toHaveBeenCalledWith("media-id", now);
  });

  it("retains a pending record and audits a storage failure", async () => {
    const putObject = vi.fn(async () => {
      throw new Error("third-party response must not be persisted");
    });
    const dependencies = createDependencies({
      objectStorage: {
        putObject,
        deleteObject: vi.fn(async () => undefined),
      },
    });
    const service = createMediaService(dependencies);

    await expect(
      service.upload(activeAdmin, {
        bytes: Buffer.from("validated bytes"),
        declaredMimeType: "image/png",
        altText: null,
      }),
    ).rejects.toThrow("Media upload failed");
    expect(dependencies.markReady).not.toHaveBeenCalled();
    expect(dependencies.recordFailure).toHaveBeenCalledWith({
      mediaId: "media-id",
      actorUserId: "admin-id",
      occurredAt: now,
      reason: "OBJECT_STORAGE_WRITE_FAILED",
    });
    expect(JSON.stringify(vi.mocked(dependencies.recordFailure).mock.calls)).not.toContain(
      "third-party response",
    );
  });

  it("rejects overlong alt text before persistence", async () => {
    const dependencies = createDependencies();
    const service = createMediaService(dependencies);

    await expect(
      service.upload(activeAdmin, {
        bytes: Buffer.from("validated bytes"),
        declaredMimeType: "image/png",
        altText: "a".repeat(241),
      }),
    ).rejects.toThrow(/alt text/i);
    expect(dependencies.createPending).not.toHaveBeenCalled();
  });
});
