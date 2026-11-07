import { db } from "@/db";
import { bundleExports } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ZipArchive } from "archiver";
import { PassThrough } from "node:stream";
import {
  getDefaultBackupBucket,
  ensureBucketExists,
  downloadObjectBuffer,
  uploadExportArchive,
} from "@/lib/storage/s3";
import { getExportCandidates } from "./selection";
import {
  generateRestorationGuideReadme,
  generateExportManifestJson,
  getArchiveBundlePath,
} from "./manifest";

export interface ExecuteBundleExportParams {
  exportId: string;
}

export interface ExecuteBundleExportResult {
  exportId: string;
  status: "completed" | "failed";
  s3Bucket?: string;
  s3Key?: string;
  totalSizeBytes?: number;
  errorMessage?: string;
}

/**
 * Builds a ZIP archive from selected S3 backup bundles and streams it back to S3.
 */
export async function executeBundleExport({
  exportId,
}: ExecuteBundleExportParams): Promise<ExecuteBundleExportResult> {
  // 1. Fetch export record
  const [exportRecord] = await db
    .select()
    .from(bundleExports)
    .where(eq(bundleExports.id, exportId))
    .limit(1);

  if (!exportRecord) {
    throw new Error(`Bundle export with id "${exportId}" not found`);
  }

  // 2. Mark processing
  await db
    .update(bundleExports)
    .set({
      status: "processing",
      updatedAt: new Date(),
    })
    .where(eq(bundleExports.id, exportId));

  try {
    const bucket = exportRecord.s3Bucket || getDefaultBackupBucket();
    await ensureBucketExists(bucket);

    // 3. Resolve candidate bundles
    const repoIds = Array.isArray(exportRecord.repositoryIds)
      ? (exportRecord.repositoryIds as string[])
      : [];

    const selection = await getExportCandidates({
      userId: exportRecord.userId,
      repositoryIds: repoIds.length > 0 ? repoIds : undefined,
      period: exportRecord.selectedPeriod,
      startDate: exportRecord.periodStart || undefined,
      endDate: exportRecord.periodEnd || undefined,
      includeAllSnapshots: exportRecord.includeAllSnapshots,
    });

    if (selection.candidates.length === 0) {
      throw new Error("No completed backup bundles found matching the export criteria");
    }

    // 4. Initialize Archiver ZIP stream
    const archive = new ZipArchive({
      zlib: { level: 6 }, // standard compression
    });

    const streamPassThrough = new PassThrough();
    const chunks: Buffer[] = [];

    streamPassThrough.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    const zipPromise = new Promise<Buffer>((resolve, reject) => {
      streamPassThrough.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
      streamPassThrough.on("error", reject);
      archive.on("error", reject);
    });

    archive.pipe(streamPassThrough);

    // 5. Append candidate bundles to ZIP
    for (const candidate of selection.candidates) {
      const bundleBuffer = await downloadObjectBuffer({
        bucket: candidate.s3Bucket,
        key: candidate.s3Key,
      });

      const entryPath = getArchiveBundlePath(candidate);
      archive.append(bundleBuffer, { name: entryPath });
    }

    // 6. Append README.md and export-manifest.json
    const readmeContent = generateRestorationGuideReadme(selection.candidates, {
      exportId,
      createdAt: new Date(),
      totalSizeBytes: selection.totalSizeBytes,
    });
    archive.append(readmeContent, { name: "README.md" });

    const manifestContent = generateExportManifestJson(selection.candidates, {
      exportId,
      userId: exportRecord.userId,
      createdAt: new Date(),
      totalSizeBytes: selection.totalSizeBytes,
    });
    archive.append(manifestContent, { name: "export-manifest.json" });

    // Finalize archive
    await archive.finalize();
    const zipBuffer = await zipPromise;

    // 7. Upload final ZIP to S3
    const timestamp = Date.now();
    const s3Key = `exports/${exportRecord.userId}/${exportId}/export-${timestamp}.zip`;

    const uploadResult = await uploadExportArchive({
      bucket,
      key: s3Key,
      body: zipBuffer,
      sizeBytes: zipBuffer.length,
    });

    const completedAt = new Date();
    const expiresAt = new Date(completedAt.getTime() + 24 * 60 * 60 * 1000); // 24-hour retention

    // 8. Update database record as completed
    await db
      .update(bundleExports)
      .set({
        status: "completed",
        s3Bucket: uploadResult.bucket,
        s3Key: uploadResult.key,
        totalSizeBytes: zipBuffer.length,
        bundleCount: selection.bundleCount,
        repositoryCount: selection.repositoryCount,
        completedAt,
        expiresAt,
        updatedAt: completedAt,
      })
      .where(eq(bundleExports.id, exportId));

    return {
      exportId,
      status: "completed",
      s3Bucket: uploadResult.bucket,
      s3Key: uploadResult.key,
      totalSizeBytes: zipBuffer.length,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    await db
      .update(bundleExports)
      .set({
        status: "failed",
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(bundleExports.id, exportId));

    return {
      exportId,
      status: "failed",
      errorMessage,
    };
  }
}
