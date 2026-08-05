import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSiteAccess, errorResponseBody, HttpError } from "@/lib/auth-guards";
import { getStorage } from "@/lib/storage";

/**
 * DELETE /api/attachments/[attachmentId] — removes the DB row and calls
 * storage.remove(). Authorized by walking attachment -> taskRow -> section
 * -> report -> siteId.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  try {
    const { attachmentId } = await params;
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { taskRow: { include: { section: { include: { report: true } } } } },
    });
    if (!attachment) throw new HttpError(404, "Attachment not found");

    const siteId = attachment.taskRow.section.report.siteId;
    await requireSiteAccess(siteId);

    if (attachment.taskRow.section.status !== "DRAFT") {
      throw new HttpError(409, "Section is submitted; ask an admin to reopen it before removing photos");
    }

    await prisma.attachment.delete({ where: { id: attachmentId } });

    const storage = getStorage();
    await storage.remove(attachment.storageKey).catch((err) => {
      // The DB row is the source of truth for the UI; a storage-layer
      // failure to delete the physical file shouldn't block the request or
      // leave the row dangling. Log and move on.
      console.error(`Failed to remove storage object ${attachment.storageKey}:`, err);
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = errorResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
