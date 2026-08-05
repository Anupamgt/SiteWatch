"use client";

import { useEffect, useRef, useState } from "react";

type Attachment = {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

/**
 * Thumbnail row + native file picker for task-row photos. A row must be
 * persisted before it can hold Attachments (Attachment.taskRowId is
 * required), so if `taskRowId` isn't set yet, the caller's
 * `onRequireRowSave` is invoked first to flush a draft save and obtain one.
 */
export function PhotoStrip({
  taskRowId,
  onRequireRowSave,
  disabled,
}: {
  taskRowId?: string;
  onRequireRowSave?: () => Promise<string | undefined>;
  disabled?: boolean;
}) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (!taskRowId) {
      return () => {
        cancelled = true;
      };
    }
    // Standard fetch-on-mount pattern: flip the loading flag before kicking off the request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/task-rows/${taskRowId}/attachments`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setAttachments(data.attachments ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load photos");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taskRowId]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      let rowId = taskRowId;
      if (!rowId && onRequireRowSave) {
        rowId = await onRequireRowSave();
      }
      if (!rowId) {
        throw new Error("Save the row before attaching photos");
      }

      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/uploads", { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadData.error || `Failed to upload ${file.name}`);
        }

        const linkRes = await fetch(`/api/task-rows/${rowId}/attachments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(uploadData),
        });
        const linkData = await linkRes.json();
        if (!linkRes.ok) {
          throw new Error(linkData.error || `Failed to attach ${file.name}`);
        }
        setAttachments((prev) => [...prev, linkData.attachment]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(attachmentId: string) {
    if (!confirm("Remove this photo?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/attachments/${attachmentId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete photo");
      }
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete photo");
    }
  }

  // No taskRowId means the row hasn't been persisted yet, so it can't have
  // any attachments — show nothing rather than a stale list from before.
  const visibleAttachments = taskRowId ? attachments : [];

  return (
    <div>
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

      {(loading || visibleAttachments.length > 0) && (
        <div className="mb-2 flex flex-wrap gap-2">
          {visibleAttachments.map((a) => (
            <div key={a.id} className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.filename} className="h-full w-full object-cover" />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleDelete(a.id)}
                  aria-label={`Remove ${a.filename}`}
                  className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs font-bold text-white"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!disabled && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            capture="environment"
            multiple
            className="hidden"
            id={`photo-input-${taskRowId ?? "new"}`}
            onChange={(e) => handleFiles(e.target.files)}
          />
          <label
            htmlFor={`photo-input-${taskRowId ?? "new"}`}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-dashed border-slate-300 px-4 text-sm font-medium text-slate-600 hover:border-amber-400 hover:text-amber-700"
          >
            {uploading ? "Uploading…" : "📷 Add photo"}
          </label>
        </>
      )}
    </div>
  );
}
