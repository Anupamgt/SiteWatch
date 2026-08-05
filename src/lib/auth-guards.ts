import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Thin, typed HTTP errors so route handlers can `catch` and map to a status
 * code without every guard re-implementing Response construction.
 */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

/** Session or throw 401. Use in Server Components and API routes alike. */
export async function requireUser(): Promise<Session["user"]> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new HttpError(401, "Not authenticated");
  }
  return session.user;
}

/** Session with role === "ADMIN" or throw 403. */
export async function requireAdmin(): Promise<Session["user"]> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new HttpError(403, "Admin access required");
  }
  return user;
}

/**
 * Admins pass implicitly (they are not required to hold a SiteMembership row).
 * Engineers must have an active SiteMembership for the given site.
 * Every API route must call this itself — middleware is a convenience only.
 */
export async function requireSiteAccess(siteId: string): Promise<Session["user"]> {
  const user = await requireUser();
  if (user.role === "ADMIN") return user;

  const membership = await prisma.siteMembership.findUnique({
    where: { userId_siteId: { userId: user.id, siteId } },
  });
  if (!membership) {
    throw new HttpError(403, "You do not have access to this site");
  }
  return user;
}

/** Converts a thrown HttpError (or unknown error) into a NextResponse-shaped payload. */
export function errorResponseBody(err: unknown): { status: number; body: { error: string } } {
  if (err instanceof HttpError) {
    return { status: err.status, body: { error: err.message } };
  }
  console.error(err);
  return { status: 500, body: { error: "Internal server error" } };
}
