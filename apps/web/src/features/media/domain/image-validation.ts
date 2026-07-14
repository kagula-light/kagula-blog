import { createHash } from "node:crypto";

import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";

export type SupportedImageExtension = "avif" | "jpg" | "png" | "webp";
export type SupportedImageMimeType = "image/avif" | "image/jpeg" | "image/png" | "image/webp";

export interface ValidateImageUploadInput {
  readonly bytes: Uint8Array;
  readonly declaredMimeType: string;
  readonly maximumBytes: number;
  readonly maximumDimension: number;
}

export interface ValidatedImage {
  readonly mimeType: SupportedImageMimeType;
  readonly extension: SupportedImageExtension;
  readonly byteSize: number;
  readonly width: number;
  readonly height: number;
  readonly checksumSha256: string;
}

const supportedImageTypes = new Map<string, SupportedImageExtension>([
  ["image/avif", "avif"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function appearsToBeSvg(bytes: Uint8Array): boolean {
  const prefix = Buffer.from(bytes.subarray(0, 512)).toString("utf8").trimStart().toLowerCase();
  return prefix.startsWith("<svg") || (prefix.startsWith("<?xml") && prefix.includes("<svg"));
}

export async function validateImageUpload({
  bytes,
  declaredMimeType,
  maximumBytes,
  maximumDimension,
}: ValidateImageUploadInput): Promise<ValidatedImage> {
  if (bytes.byteLength === 0 || bytes.byteLength > maximumBytes) {
    throw new Error("Image size exceeds the configured upload limit");
  }
  if (appearsToBeSvg(bytes)) {
    throw new Error("SVG image uploads are not supported");
  }

  const detected = await fileTypeFromBuffer(bytes);
  const extension = detected ? supportedImageTypes.get(detected.mime) : undefined;
  if (!detected || !extension) {
    throw new Error("Image format is not supported");
  }

  const normalizedDeclaredMime = declaredMimeType.split(";", 1)[0]?.trim().toLowerCase();
  if (normalizedDeclaredMime !== detected.mime) {
    throw new Error("Declared image MIME type does not match the file header");
  }

  const metadata = await sharp(bytes, { failOn: "error" }).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Image dimensions could not be read");
  }
  if (metadata.width > maximumDimension || metadata.height > maximumDimension) {
    throw new Error("Image dimensions exceed the configured limit");
  }

  return {
    mimeType: detected.mime as SupportedImageMimeType,
    extension,
    byteSize: bytes.byteLength,
    width: metadata.width,
    height: metadata.height,
    checksumSha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

export interface CreateMediaObjectKeyInput {
  readonly extension: SupportedImageExtension;
  readonly now: Date;
  readonly randomId: string;
}

export function createMediaObjectKey({
  extension,
  now,
  randomId,
}: CreateMediaObjectKeyInput): string {
  if (!/^[a-z0-9-]{16,64}$/.test(randomId)) {
    throw new Error("Media object identifier is invalid");
  }
  const year = now.getUTCFullYear().toString().padStart(4, "0");
  const month = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  return `media/${year}/${month}/${randomId}.${extension}`;
}
