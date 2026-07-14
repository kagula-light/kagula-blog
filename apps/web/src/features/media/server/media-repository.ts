import type { DatabaseClient } from "@kagura/database/client";
import { auditLogs, mediaAssets } from "@kagura/database/schema";
import { and, desc, eq } from "drizzle-orm";

import type {
  MediaFailureRecord,
  MediaServiceDependencies,
  PendingMediaRecord,
} from "./media-service";

export interface MediaListItem {
  readonly id: string;
  readonly objectKey: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly width: number;
  readonly height: number;
  readonly altText: string | null;
  readonly status: "PENDING" | "READY" | "DELETED";
  readonly createdAt: Date;
}

export interface MediaRepository extends Pick<
  MediaServiceDependencies,
  "createPending" | "markReady" | "recordFailure"
> {
  readonly listMedia: (limit?: number) => Promise<readonly MediaListItem[]>;
}

export function createMediaRepository(database: DatabaseClient): MediaRepository {
  return {
    createPending: async (input): Promise<PendingMediaRecord> =>
      database.db.transaction(async (transaction) => {
        const [media] = await transaction
          .insert(mediaAssets)
          .values({
            ownerUserId: input.ownerUserId,
            objectKey: input.objectKey,
            mimeType: input.mimeType,
            byteSize: input.byteSize,
            width: input.width,
            height: input.height,
            checksumSha256: input.checksumSha256,
            altText: input.altText,
            status: "PENDING",
            createdAt: input.createdAt,
            updatedAt: input.createdAt,
          })
          .returning({ id: mediaAssets.id });
        if (!media) throw new Error("Pending media creation did not return a row");

        await transaction.insert(auditLogs).values({
          actorUserId: input.ownerUserId,
          action: "MEDIA_UPLOAD_STARTED",
          resourceType: "MEDIA_ASSET",
          resourceId: media.id,
          summary: { objectKey: input.objectKey, mimeType: input.mimeType },
          createdAt: input.createdAt,
        });
        return { id: media.id, ...input, status: "PENDING" };
      }),

    markReady: async (mediaId, updatedAt) => {
      await database.db.transaction(async (transaction) => {
        const [media] = await transaction
          .update(mediaAssets)
          .set({ status: "READY", updatedAt })
          .where(and(eq(mediaAssets.id, mediaId), eq(mediaAssets.status, "PENDING")))
          .returning({ ownerUserId: mediaAssets.ownerUserId });
        if (!media) throw new Error("Pending media was not found");
        await transaction.insert(auditLogs).values({
          actorUserId: media.ownerUserId,
          action: "MEDIA_UPLOAD_COMPLETED",
          resourceType: "MEDIA_ASSET",
          resourceId: mediaId,
          createdAt: updatedAt,
        });
      });
    },

    recordFailure: async ({ mediaId, actorUserId, occurredAt, reason }: MediaFailureRecord) => {
      await database.db.insert(auditLogs).values({
        actorUserId,
        action: "MEDIA_UPLOAD_FAILED",
        resourceType: "MEDIA_ASSET",
        resourceId: mediaId,
        summary: { reason },
        createdAt: occurredAt,
      });
    },

    listMedia: async (limit = 100) =>
      database.db
        .select({
          id: mediaAssets.id,
          objectKey: mediaAssets.objectKey,
          mimeType: mediaAssets.mimeType,
          byteSize: mediaAssets.byteSize,
          width: mediaAssets.width,
          height: mediaAssets.height,
          altText: mediaAssets.altText,
          status: mediaAssets.status,
          createdAt: mediaAssets.createdAt,
        })
        .from(mediaAssets)
        .orderBy(desc(mediaAssets.createdAt))
        .limit(Math.min(Math.max(limit, 1), 200)),
  };
}
