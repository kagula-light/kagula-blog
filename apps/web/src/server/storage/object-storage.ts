export interface PutObjectInput {
  readonly key: string;
  readonly body: Uint8Array;
  readonly contentType: string;
  readonly checksumSha256: string;
}

export interface ObjectStorage {
  readonly putObject: (input: PutObjectInput) => Promise<void>;
  readonly deleteObject: (key: string) => Promise<void>;
}
