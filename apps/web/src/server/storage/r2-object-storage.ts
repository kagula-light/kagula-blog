import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";

import type { ObjectStorage, PutObjectInput } from "./object-storage";

export interface R2StorageConfig {
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly forcePathStyle: boolean;
}

interface R2CommandSender {
  readonly send: (command: PutObjectCommand | DeleteObjectCommand) => Promise<unknown>;
}

function createClientConfig(config: R2StorageConfig): S3ClientConfig {
  return {
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  };
}

export function createR2ObjectStorage(
  config: R2StorageConfig,
  sender?: R2CommandSender,
): ObjectStorage {
  const client = new S3Client(createClientConfig(config));
  const commandSender: R2CommandSender =
    sender ??
    ({
      send: (command) => client.send(command),
    } satisfies R2CommandSender);

  return {
    putObject: async ({ key, body, contentType, checksumSha256 }: PutObjectInput) => {
      await commandSender.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          Metadata: { "sha256-checksum": checksumSha256 },
        }),
      );
    },
    deleteObject: async (key) => {
      await commandSender.send(
        new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: key,
        }),
      );
    },
  };
}
