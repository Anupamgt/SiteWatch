import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // Engineers may not reach /admin/*. This is a convenience redirect only —
    // every API route re-checks authorization server-side (see lib/auth-guards.ts).
    if (pathname.startsWith("/admin") && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/403", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/sites/:path*",
    "/admin/:path*",
    "/my/:path*",
    "/api/((?!auth).*)",
  ],
};
