import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ENGINEER" | "ADMIN";
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: "ENGINEER" | "ADMIN";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub: string;
    role: "ENGINEER" | "ADMIN";
  }
}
