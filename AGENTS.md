<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

SiteWatch is a single Next.js 16 (App Router) full-stack app. The only external runtime dependency is PostgreSQL. Standard commands live in `README.md` and `package.json` scripts; the notes below are the non-obvious bits for running it in this environment.

Services and how to run them:
- Database: PostgreSQL 16 is installed via apt (not Docker — Docker is not available here) and runs on host port `5433` to match `docker-compose.yml`/`.env.example`. It is not auto-started on boot; start it with `sudo pg_ctlcluster 16 main start` and check with `pg_isready -h localhost -p 5433`. The role/db (`dpr` / `dpr_site_control`, password `dpr`) and applied migrations + seed data persist in the VM snapshot.
- App: `npm run dev` binds `http://localhost:3000`. Run lint with `npm run lint`, tests with `npm test`.

Non-obvious gotchas:
- `.env` is gitignored. If it is missing, create it from `.env.example` and set a real `NEXTAUTH_SECRET` (`openssl rand -base64 32`); the defaults in `.env.example` already point at the local Postgres on port `5433` with `EMAIL_PROVIDER=console` and `STORAGE_DRIVER=local`, so no external services are needed.
- Seed the DB with `npx prisma db seed`, NOT `npm run db:seed`. The `db:seed` script calls `tsx prisma/seed.ts` directly, which does not load `.env`, so `DATABASE_URL` is undefined and seeding fails. `npx prisma db seed` loads `.env` first. (`npx prisma migrate deploy` loads `.env` on its own.)
- Prisma must stay on v6 (pinned in `package.json`); v7 fails to parse the schema.
- `next dev` regenerates `AGENTS.md` and `CLAUDE.md` (the `nextjs-agent-rules` block) on every run — this is expected; committing them keeps the tree clean.
- Seeded logins: `admin@example.com` / `admin123` (admin), `engineer@example.com` / `engineer123` (engineer).
