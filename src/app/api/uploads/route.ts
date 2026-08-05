import { NextRequest, NextResponse } from "next/server";
import { requireUser, errorResponseBody } from "@/lib/auth-guards";
import { getStorage, ALLOWED_PHOTO_MIME_TYPES, MAX_PHOTO_SIZE_BYTES } from "@/lib/storage";

/**
 * POST /api/uploads — multipart, one file. Returns { url, storageKey,
 * filename, mimeType, sizeBytes }. Enforces MIME type and size server-side
 * (never trust the client `accept` attribute). This endpoint only writes
 * the file to storage; linking it to a TaskRow happens via
 * POST /api/task-rows/[taskRowId]/attachments.
 */
export async function POST(req: NextRequest) {
  try {
    // Any authenticated user may upload; the *link* endpoint is what
    // enforces site membership + DRAFT status for a specific task row.
    await requireUser();

    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field" }, { status: 400 });
    }

    if (!ALLOWED_PHOTO_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type "${file.type}". Allowed: JPEG, PNG, WEBP, HEIC.` },
        { status: 400 }
      );
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Max is 10 MB.` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storage = getStorage();
    const { url, storageKey } = await storage.put({
      buffer,
      filename: file.name,
      mimeType: file.type,
    });

    return NextResponse.json({
      url,
      storageKey,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
