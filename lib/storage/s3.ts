import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommandInput,
  BucketLocationConstraint,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "node:fs";
import { Readable } from "node:stream";

export interface UploadBundleParams {
  bucket: string;
  key: string;
  filePath?: string;
  body?: Readable | Buffer;
  sizeBytes?: number;
}

export interface UploadBundleResult {
  bucket: string;
  key: string;
  sizeBytes: number;
  serverSideEncryption?: string;
}

export interface MockS3Storage {
  ensureBucketCalls: string[];
  uploadCalls: Array<{
    bucket: string;
    key: string;
    sizeBytes?: number;
    encryption?: string;
  }>;
  presignedUrlCalls?: Array<{
    bucket: string;
    key: string;
    expiresInSeconds: number;
    downloadFilename?: string;
  }>;
  deleteCalls?: Array<{
    bucket: string;
    key: string;
  }>;
  onEnsureBucket?: (bucket: string) => Promise<void>;
  onUpload?: (params: UploadBundleParams) => Promise<UploadBundleResult>;
  onGetSignedUrl?: (params: {
    bucket: string;
    key: string;
    expiresInSeconds: number;
    downloadFilename?: string;
  }) => Promise<string>;
  onDelete?: (params: { bucket: string; key: string }) => Promise<void>;
}

let mockStorage: MockS3Storage | null = null;
const verifiedBuckets = new Set<string>();

export function setMockS3Storage(mock: MockS3Storage | null) {
  mockStorage = mock;
  if (!mock) {
    verifiedBuckets.clear();
  }
}

export function getMockS3Storage(): MockS3Storage | null {
  return mockStorage;
}

export function getDefaultBackupBucket(): string {
  return process.env.S3_BUCKET || "repo-backups";
}

export function getS3Client(): S3Client {
  return new S3Client({
    region: process.env.AWS_REGION || "us-east-2",
    endpoint: process.env.AWS_ENDPOINT_URL_S3,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
    forcePathStyle: true,
  });
}

/**
 * Generates the structured S3 key for a backup bundle:
 * backups/{userId}/{owner}/{repo}/{timestamp}-{commitSha}.bundle
 */
export function generateBackupKey(
  userId: string,
  owner: string,
  repo: string,
  commitSha: string,
  timestamp: number | string = Date.now(),
): string {
  const cleanSha = commitSha.trim().slice(0, 40);
  return `backups/${userId}/${owner}/${repo}/${timestamp}-${cleanSha}.bundle`;
}

/**
 * Verifies that the configured S3 bucket exists, and creates it with SSE enabled if it does not.
 */
export async function ensureBucketExists(
  bucketName: string = getDefaultBackupBucket(),
  client: S3Client = getS3Client(),
): Promise<void> {
  if (mockStorage) {
    mockStorage.ensureBucketCalls.push(bucketName);
    if (mockStorage.onEnsureBucket) {
      await mockStorage.onEnsureBucket(bucketName);
    }
    return;
  }

  if (verifiedBuckets.has(bucketName)) {
    return;
  }

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucketName }));
    verifiedBuckets.add(bucketName);
  } catch (err: unknown) {
    const error = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    const isNotFound =
      error.name === "NotFound" ||
      error.name === "NoSuchBucket" ||
      error.$metadata?.httpStatusCode === 404;

    if (isNotFound) {
      try {
        const createParams: CreateBucketCommandInput = {
          Bucket: bucketName,
        };

        const region = process.env.AWS_REGION;
        if (region && region !== "us-east-1" && !process.env.AWS_ENDPOINT_URL_S3) {
          createParams.CreateBucketConfiguration = {
            LocationConstraint: region as BucketLocationConstraint,
          };
        }

        await client.send(new CreateBucketCommand(createParams));
        verifiedBuckets.add(bucketName);
      } catch (createErr: unknown) {
        const cErr = createErr as { name?: string };
        if (
          cErr.name === "BucketAlreadyOwnedByYou" ||
          cErr.name === "BucketAlreadyExists"
        ) {
          verifiedBuckets.add(bucketName);
          return;
        }
        throw createErr;
      }
    } else {
      throw err;
    }
  }
}

/**
 * Streams a local Git bundle file to S3 with SSE-S3 encryption and structured key naming.
 */
export async function uploadBackupBundle(
  params: UploadBundleParams,
  client: S3Client = getS3Client(),
): Promise<UploadBundleResult> {
  if (mockStorage) {
    mockStorage.uploadCalls.push({
      bucket: params.bucket,
      key: params.key,
      sizeBytes: params.sizeBytes,
      encryption: "AES256",
    });

    if (mockStorage.onUpload) {
      return mockStorage.onUpload(params);
    }

    return {
      bucket: params.bucket,
      key: params.key,
      sizeBytes: params.sizeBytes ?? 0,
      serverSideEncryption: "AES256",
    };
  }

  let body: Readable | Buffer;
  let sizeBytes = params.sizeBytes;

  if (params.filePath) {
    const stat = await fs.promises.stat(params.filePath);
    sizeBytes = stat.size;
    body = fs.createReadStream(params.filePath);
  } else if (params.body) {
    body = params.body;
  } else {
    throw new Error("uploadBackupBundle requires either filePath or body");
  }

  const command = new PutObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
    Body: body,
    ContentLength: sizeBytes,
    ContentType: "application/x-git-bundle",
    ServerSideEncryption: "AES256", // SSE-S3 requirement
  });

  const response = await client.send(command);

  return {
    bucket: params.bucket,
    key: params.key,
    sizeBytes: sizeBytes ?? 0,
    serverSideEncryption: response.ServerSideEncryption || "AES256",
  };
}

export interface PresignedDownloadUrlParams {
  bucket: string;
  key: string;
  expiresInSeconds?: number;
  downloadFilename?: string;
  client?: S3Client;
}

/**
 * Generates a temporary pre-signed S3 URL for downloading a backup bundle.
 * Defaults to 15 minutes (900 seconds) expiration.
 */
export async function createPresignedDownloadUrl(
  params: PresignedDownloadUrlParams,
): Promise<string> {
  const expiresIn = params.expiresInSeconds ?? 900;

  if (mockStorage) {
    if (!mockStorage.presignedUrlCalls) {
      mockStorage.presignedUrlCalls = [];
    }
    mockStorage.presignedUrlCalls.push({
      bucket: params.bucket,
      key: params.key,
      expiresInSeconds: expiresIn,
      downloadFilename: params.downloadFilename,
    });

    if (mockStorage.onGetSignedUrl) {
      return mockStorage.onGetSignedUrl({
        bucket: params.bucket,
        key: params.key,
        expiresInSeconds: expiresIn,
        downloadFilename: params.downloadFilename,
      });
    }

    return `https://mock-s3.amazonaws.com/${params.bucket}/${params.key}?X-Amz-Expires=${expiresIn}&mock-signed=true`;
  }

  const client = params.client || getS3Client();
  const command = new GetObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
    ...(params.downloadFilename
      ? {
          ResponseContentDisposition: `attachment; filename="${params.downloadFilename}"`,
        }
      : {}),
  });

  return getSignedUrl(client, command, { expiresIn });
}

export interface DeleteBundleParams {
  bucket: string;
  key: string;
  client?: S3Client;
}

/**
 * Permanently deletes a backup bundle from S3 storage using DeleteObjectCommand.
 */
export async function deleteBackupBundle(
  params: DeleteBundleParams,
  client?: S3Client,
): Promise<void> {
  if (mockStorage) {
    if (!mockStorage.deleteCalls) {
      mockStorage.deleteCalls = [];
    }
    mockStorage.deleteCalls.push({
      bucket: params.bucket,
      key: params.key,
    });

    if (mockStorage.onDelete) {
      await mockStorage.onDelete({ bucket: params.bucket, key: params.key });
    }
    return;
  }

  const s3 = client || params.client || getS3Client();
  const command = new DeleteObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
  });

  await s3.send(command);
}

