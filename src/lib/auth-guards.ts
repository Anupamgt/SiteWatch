import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cacheGet, cacheSet } from "@/lib/cache";

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

/** Session with role === "ADMIN" or throw 403. People/org directory is admin-only. */
export async function requireAdmin(): Promise<Session["user"]> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new HttpError(403, "Admin access required");
  }
  return user;
}

/** Site-scoped roles (engineer / supervisor) see only assigned sites. Admins bypass. */
export function isSiteScopedRole(role: string): boolean {
  return role === "ENGINEER" || role === "SUPERVISOR";
}

/**
 * Admins pass implicitly (they are not required to hold a SiteMembership row).
 * Engineers and supervisors must have an active SiteMembership for the given site.
 * Membership checks are cached briefly to keep submit/autosave snappy.
 */
export async function requireSiteAccess(siteId: string): Promise<Session["user"]> {
  const user = await requireUser();
  if (user.role === "ADMIN") return user;

  const cacheKey = `membership:${user.id}:${siteId}`;
  const cached = await cacheGet<boolean>(cacheKey);
  if (cached === true) return user;
  if (cached === false) {
    throw new HttpError(403, "You do not have access to this site");
  }

  const membership = await prisma.siteMembership.findUnique({
    where: { userId_siteId: { userId: user.id, siteId } },
    select: { id: true },
  });
  await cacheSet(cacheKey, Boolean(membership), 120);
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
