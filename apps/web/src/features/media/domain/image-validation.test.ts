import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { createMediaObjectKey, validateImageUpload } from "./image-validation";

async function createImage(format: "avif" | "jpeg" | "png" | "webp", size = 2) {
  const image = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 30, g: 120, b: 210, alpha: 1 },
    },
  });
  return image[format]().toBuffer();
}

describe("validateImageUpload", () => {
  it.each([
    ["jpeg", "image/jpeg", "jpg"],
    ["png", "image/png", "png"],
    ["webp", "image/webp", "webp"],
    ["avif", "image/avif", "avif"],
  ] as const)("accepts a genuine %s image", async (format, mimeType, extension) => {
    const bytes = await createImage(format);

    await expect(
      validateImageUpload({
        bytes,
        declaredMimeType: mimeType,
        maximumBytes: 1_000_000,
        maximumDimension: 4_096,
      }),
    ).resolves.toMatchObject({
      mimeType,
      extension,
      byteSize: bytes.length,
      width: 2,
      height: 2,
    });
  });

  it("calculates a lowercase SHA-256 checksum", async () => {
    const bytes = await createImage("png");
    const result = await validateImageUpload({
      bytes,
      declaredMimeType: "image/png",
      maximumBytes: 1_000_000,
      maximumDimension: 4_096,
    });

    expect(result.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects a declared MIME type that does not match the file header", async () => {
    const bytes = await createImage("png");

    await expect(
      validateImageUpload({
        bytes,
        declaredMimeType: "image/jpeg",
        maximumBytes: 1_000_000,
        maximumDimension: 4_096,
      }),
    ).rejects.toThrow(/mime/i);
  });

  it("rejects SVG even when declared as an image", async () => {
    const bytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

    await expect(
      validateImageUpload({
        bytes,
        declaredMimeType: "image/svg+xml",
        maximumBytes: 1_000_000,
        maximumDimension: 4_096,
      }),
    ).rejects.toThrow(/svg|format/i);
  });

  it("rejects files larger than the configured byte limit", async () => {
    const bytes = await createImage("png");

    await expect(
      validateImageUpload({
        bytes,
        declaredMimeType: "image/png",
        maximumBytes: bytes.length - 1,
        maximumDimension: 4_096,
      }),
    ).rejects.toThrow(/size/i);
  });

  it("rejects images wider or taller than the configured dimension", async () => {
    const bytes = await createImage("png", 8);

    await expect(
      validateImageUpload({
        bytes,
        declaredMimeType: "image/png",
        maximumBytes: 1_000_000,
        maximumDimension: 4,
      }),
    ).rejects.toThrow(/dimension/i);
  });
});

describe("createMediaObjectKey", () => {
  it("uses a server-generated identifier and UTC date path", () => {
    expect(
      createMediaObjectKey({
        extension: "webp",
        now: new Date("2026-07-14T23:30:00.000Z"),
        randomId: "0190f3c2-5710-7aca-b167-8f4b28ad77c1",
      }),
    ).toBe("media/2026/07/0190f3c2-5710-7aca-b167-8f4b28ad77c1.webp");
  });
});
