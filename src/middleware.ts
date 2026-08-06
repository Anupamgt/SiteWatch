import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // Engineers / supervisors may not reach /admin/* (People, org config).
    // Send them to their site home instead of a dead-end 403.
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
