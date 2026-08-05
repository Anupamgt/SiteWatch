import type { StorageAdapter, PutFileInput, PutFileResult } from "./index";
import { extensionForMimeType } from "./index";
import { randomUUID } from "crypto";

/**
 * Google Cloud Storage adapter (production). Uses `GCS_BUCKET` and standard
 * Application Default Credentials (`GOOGLE_APPLICATION_CREDENTIALS`, or the
 * Cloud Run/GCE metadata server — no explicit key file needed there).
 *
 * `@google-cloud/storage` is imported dynamically inside this factory (not
 * at module scope) so that requesting the `local` driver never requires the
 * GCS SDK to be resolvable/initialised — matches the interface in
 * `lib/storage/index.ts`.
 */
export function createGcsStorage(): StorageAdapter {
  const bucketName = process.env.GCS_BUCKET;
  if (!bucketName) {
    throw new Error("STORAGE_DRIVER=gcs requires GCS_BUCKET to be set");
  }

  return {
    async put(file: PutFileInput): Promise<PutFileResult> {
      const { Storage } = await import("@google-cloud/storage");
      const storage = new Storage({
        projectId: process.env.GCS_PROJECT_ID || undefined,
      });
      const bucket = storage.bucket(bucketName);

      const now = new Date();
      const yyyy = String(now.getUTCFullYear());
      const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
      const ext = extensionForMimeType(file.mimeType);
      const storageKey = `${yyyy}/${mm}/${randomUUID()}.${ext}`;

      const gcsFile = bucket.file(storageKey);
      await gcsFile.save(file.buffer, {
        contentType: file.mimeType,
        resumable: false,
      });

      // Bucket must be configured for public read (uniform bucket-level
      // access + allUsers:objectViewer) or fronted by a CDN/signed-URL
      // layer; the MVP assumes site photos are not sensitive enough to
      // require per-request signed URLs. Revisit before storing anything
      // confidential.
      const url = `https://storage.googleapis.com/${bucketName}/${storageKey}`;
      return { url, storageKey };
    },

    async remove(storageKey: string): Promise<void> {
      const { Storage } = await import("@google-cloud/storage");
      const storage = new Storage({
        projectId: process.env.GCS_PROJECT_ID || undefined,
      });
      await storage.bucket(bucketName).file(storageKey).delete({ ignoreNotFound: true });
    },
  };
}
