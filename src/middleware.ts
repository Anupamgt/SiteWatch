import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // Engineers may not reach /admin/*. Send them to their home instead of a dead-end 403
    // when a leftover callbackUrl=/admin is present after login.
    if (pathname.startsWith("/admin") && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/sites", req.url));
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
