/**
 * Register (or update) a Google-allowlisted user for NextAuth Google sign-in.
 *
 * Usage:
 *   npx tsx scripts/register-google-user.ts you@gmail.com ADMIN "Your Name"
 *   npx tsx scripts/register-google-user.ts engineer@gmail.com ENGINEER
 *   npx tsx scripts/register-google-user.ts supervisor@gmail.com SUPERVISOR "Name"
 *
 * Google OAuth never auto-creates users — the email must exist and be active.
 * Password is optional (omit for Google-only accounts).
 *
 * Optional 4th arg = password for credentials login fallback:
 *   npx tsx scripts/register-google-user.ts you@gmail.com SUPERVISOR "You" secretpass
 */
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ROLES = new Set<Role>(["ADMIN", "ENGINEER", "SUPERVISOR"]);

async function main() {
  const [emailRaw, roleRaw, nameRaw, password] = process.argv.slice(2);
  if (!emailRaw) {
    console.error(
      "Usage: npx tsx scripts/register-google-user.ts <email> [ADMIN|ENGINEER|SUPERVISOR] [name] [password]"
    );
    process.exit(1);
  }

  const email = emailRaw.trim().toLowerCase();
  const roleCandidate = (roleRaw?.toUpperCase() || "ADMIN") as Role;
  const role = ROLES.has(roleCandidate) ? roleCandidate : ("ADMIN" as Role);
  const name = nameRaw?.trim() || email.split("@")[0] || "User";
  const passwordHash = password ? await bcrypt.hash(password, 12) : null;

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      role,
      name,
      isActive: true,
      ...(passwordHash ? { passwordHash } : {}),
    },
    create: {
      email,
      name,
      role,
      isActive: true,
      passwordHash,
    },
  });

  console.log(
    JSON.stringify(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        googleOnly: !user.passwordHash,
        next: "Sign in with Continue with Google using this exact Gmail address.",
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
