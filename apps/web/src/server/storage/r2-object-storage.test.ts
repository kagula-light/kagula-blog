import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import { createR2ObjectStorage } from "./r2-object-storage";

const config = {
  endpoint: "https://account.r2.cloudflarestorage.com",
  region: "auto",
  bucket: "kagura-assets",
  accessKeyId: "test-access-key",
  secretAccessKey: "test-secret-key",
  forcePathStyle: false,
} as const;

describe("R2 object storage", () => {
  it("sends an object with content metadata and checksum", async () => {
    const send = vi.fn<(command: PutObjectCommand | DeleteObjectCommand) => Promise<unknown>>(
      async () => ({}),
    );
    const storage = createR2ObjectStorage(config, { send });
    const body = Buffer.from("image bytes");

    await storage.putObject({
      key: "media/2026/07/image.png",
      body,
      contentType: "image/png",
      checksumSha256: "a".repeat(64),
    });

    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command?.input).toMatchObject({
      Bucket: "kagura-assets",
      Key: "media/2026/07/image.png",
      Body: body,
      ContentType: "image/png",
      Metadata: { "sha256-checksum": "a".repeat(64) },
    });
  });

  it("deletes only the requested object key", async () => {
    const send = vi.fn<(command: PutObjectCommand | DeleteObjectCommand) => Promise<unknown>>(
      async () => ({}),
    );
    const storage = createR2ObjectStorage(config, { send });

    await storage.deleteObject("media/2026/07/image.png");

    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command?.input).toEqual({
      Bucket: "kagura-assets",
      Key: "media/2026/07/image.png",
    });
  });
});
