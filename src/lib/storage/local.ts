import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { StorageAdapter, PutFileInput, PutFileResult } from "./index";
import { extensionForMimeType } from "./index";

/**
 * Local-disk storage adapter (dev default). Writes into
 * `LOCAL_UPLOAD_DIR` (default `./public/uploads`) under a `${yyyy}/${mm}/`
 * subdirectory, keyed by a random id. `.gitignore` already ignores
 * `/public/uploads`, so this must `mkdir -p` on demand rather than assuming
 * the directory exists in a fresh checkout.
 *
 * Not durable on serverless (Vercel/Cloud Run). Use STORAGE_DRIVER=gcs in production.
 */
function uploadRoot(): string {
  const configured = process.env.LOCAL_UPLOAD_DIR || "./public/uploads";
  // Scope under cwd/public so Turbopack does not trace the whole project.
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), configured);
}

export function createLocalStorage(): StorageAdapter {
  return {
    async put(file: PutFileInput): Promise<PutFileResult> {
      const now = new Date();
      const yyyy = String(now.getUTCFullYear());
      const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
      const ext = extensionForMimeType(file.mimeType);
      const id = randomUUID();
      const relDir = path.join(yyyy, mm);
      const relKey = path.join(relDir, `${id}.${ext}`);

      const absDir = path.join(/*turbopackIgnore: true*/ uploadRoot(), relDir);
      await fs.mkdir(absDir, { recursive: true });
      await fs.writeFile(
        path.join(/*turbopackIgnore: true*/ uploadRoot(), relKey),
        file.buffer
      );

      // Always use forward slashes in the public URL and storage key,
      // regardless of the host OS path separator.
      const storageKey = relKey.split(path.sep).join("/");
      return { url: `/uploads/${storageKey}`, storageKey };
    },

    async remove(storageKey: string): Promise<void> {
      const abs = path.join(/*turbopackIgnore: true*/ uploadRoot(), storageKey);
      await fs.rm(abs, { force: true });
    },
  };
}
