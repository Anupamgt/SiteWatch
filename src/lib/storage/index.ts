/**
 * Pluggable file storage. `local` (default) writes to disk under
 * LOCAL_UPLOAD_DIR; `gcs` writes to a Google Cloud Storage bucket. Both
 * implement the same narrow interface so callers never need to know which
 * one is active. See ARCHITECTURE.md §9 / REMAINING_WORK.md Step 8.
 */
export type PutFileInput = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
};

export type PutFileResult = {
  url: string;
  storageKey: string;
};

export interface StorageAdapter {
  put(file: PutFileInput): Promise<PutFileResult>;
  remove(storageKey: string): Promise<void>;
}

let cached: StorageAdapter | null = null;

/**
 * Dispatches on STORAGE_DRIVER (default "local"). `./gcs` only defines a
 * factory function at module scope — the `@google-cloud/storage` SDK itself
 * is imported lazily *inside* `createGcsStorage()`'s returned methods (see
 * that file), so requesting the `local` driver never touches the GCS SDK.
 */
export function getStorage(): StorageAdapter {
  if (cached) return cached;
  const driver = (process.env.STORAGE_DRIVER || "local").toLowerCase();

  if (driver === "gcs") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createGcsStorage } = require("./gcs") as typeof import("./gcs");
    cached = createGcsStorage();
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createLocalStorage } = require("./local") as typeof import("./local");
    cached = createLocalStorage();
  }
  return cached;
}

/** Allowed photo MIME types + max size, enforced server-side only (I: never
 * trust the client). See REMAINING_WORK.md Step 8 "Rules". */
export const ALLOWED_PHOTO_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);
export const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

export function extensionForMimeType(mimeType: string): string {
  return EXT_BY_MIME[mimeType] ?? "bin";
}
