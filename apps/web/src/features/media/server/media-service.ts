import type { ObjectStorage } from "../../../server/storage/object-storage";
import type { PermissionIdentity } from "../../../server/permissions/policy";
import {
  createMediaObjectKey,
  type SupportedImageExtension,
  type SupportedImageMimeType,
  type ValidatedImage,
  type ValidateImageUploadInput,
} from "../domain/image-validation";

export interface PendingMediaInput extends ValidatedImage {
  readonly ownerUserId: string;
  readonly objectKey: string;
  readonly altText: string | null;
  readonly createdAt: Date;
}

export interface PendingMediaRecord extends PendingMediaInput {
  readonly id: string;
  readonly status: "PENDING";
}

export interface ReadyMediaRecord {
  readonly id: string;
  readonly ownerUserId: string;
  readonly objectKey: string;
  readonly mimeType: SupportedImageMimeType;
  readonly extension: SupportedImageExtension;
  readonly byteSize: number;
  readonly width: number;
  readonly height: number;
  readonly checksumSha256: string;
  readonly altText: string | null;
  readonly createdAt: Date;
  readonly status: "READY";
}

export interface MediaFailureRecord {
  readonly mediaId: string;
  readonly actorUserId: string;
  readonly occurredAt: Date;
  readonly reason: "OBJECT_STORAGE_WRITE_FAILED";
}

export interface MediaServiceDependencies {
  readonly validateImage: (input: ValidateImageUploadInput) => Promise<ValidatedImage>;
  readonly issueId: () => string;
  readonly clock: () => Date;
  readonly createPending: (input: PendingMediaInput) => Promise<PendingMediaRecord>;
  readonly markReady: (mediaId: string, updatedAt: Date) => Promise<void>;
  readonly recordFailure: (input: MediaFailureRecord) => Promise<void>;
  readonly objectStorage: ObjectStorage;
  readonly maximumBytes: number;
  readonly maximumDimension: number;
}

export interface UploadMediaInput {
  readonly bytes: Uint8Array;
  readonly declaredMimeType: string;
  readonly altText: string | null;
}

function assertActiveAdministrator(
  identity: PermissionIdentity | null,
): asserts identity is PermissionIdentity {
  if (identity?.role !== "ADMIN" || identity.status !== "ACTIVE") {
    throw new Error("An active administrator is required to upload media");
  }
}

function normalizeAltText(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.normalize("NFKC").trim();
  if (normalized.length === 0) return null;
  if (normalized.length > 240) throw new Error("Media alt text exceeds 240 characters");
  return normalized;
}

export function createMediaService(dependencies: MediaServiceDependencies) {
  return {
    upload: async (
      actor: PermissionIdentity | null,
      input: UploadMediaInput,
    ): Promise<ReadyMediaRecord> => {
      assertActiveAdministrator(actor);
      const altText = normalizeAltText(input.altText);
      const image = await dependencies.validateImage({
        bytes: input.bytes,
        declaredMimeType: input.declaredMimeType,
        maximumBytes: dependencies.maximumBytes,
        maximumDimension: dependencies.maximumDimension,
      });
      const occurredAt = dependencies.clock();
      const objectKey = createMediaObjectKey({
        extension: image.extension,
        now: occurredAt,
        randomId: dependencies.issueId(),
      });
      const pending = await dependencies.createPending({
        ownerUserId: actor.id,
        objectKey,
        ...image,
        altText,
        createdAt: occurredAt,
      });

      try {
        await dependencies.objectStorage.putObject({
          key: objectKey,
          body: input.bytes,
          contentType: image.mimeType,
          checksumSha256: image.checksumSha256,
        });
        await dependencies.markReady(pending.id, occurredAt);
      } catch {
        await dependencies
          .recordFailure({
            mediaId: pending.id,
            actorUserId: actor.id,
            occurredAt,
            reason: "OBJECT_STORAGE_WRITE_FAILED",
          })
          .catch(() => undefined);
        throw new Error("Media upload failed");
      }

      return { ...pending, status: "READY" };
    },
  };
}
