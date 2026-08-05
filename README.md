# SiteWatch

Daily Progress Report system for construction sites. Site engineers file reports from a phone;
head-office admins configure sites/fields, review dashboards, raise corrective actions (email),
and export Excel workbooks matching `Baijnath+Nitish.xlsx`.

One **Report** per site per calendar day holds a shared header and two independently drafted /
submitted sections: **Work Programme** and **Labour Deployment**.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- PostgreSQL via Prisma **6.x** (pin required — Prisma 7 breaks this schema)
- NextAuth v4: Credentials + optional Google OAuth
- Email: `console` (default) | Resend | SMTP
- Excel: `exceljs`

## Local setup

```bash
docker compose up -d
cp .env.example .env
# set NEXTAUTH_SECRET (openssl rand -base64 32)
npm install
npx prisma migrate deploy   # or: npx prisma migrate dev
npm run db:seed
npm run dev
```

Open http://localhost:3000

### Seeded logins

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@example.com` | `admin123` |
| Engineer | `engineer@example.com` | `engineer123` |
| Engineer | `nitish@example.com` | `nitish123` (or `SEED_SUPERVISOR_PASSWORD`) |

Change every seed password before deploying anywhere reachable outside your laptop.

Local Postgres is mapped to host port **5433**, not the Postgres default **5432** — the dev
machine this was built on already had an unrelated Postgres container bound to 5432 (see
`docker-compose.yml` and the matching `DATABASE_URL` in `.env.example`). Adjust both together if
you change it back.

## Supabase (optional cloud Postgres)

Supabase is managed PostgreSQL — no schema rewrite needed.

1. In the Supabase project: **Project Settings → Database → Connection string**.
2. Put the **Transaction pooler** URI in `DATABASE_URL` (add `?pgbouncer=true` if missing).
3. Put the **Session / Direct** URI in `DIRECT_URL` (used by `prisma migrate`).
4. Apply schema + seed:

```bash
npx prisma migrate deploy
npm run db:seed
```

## Google OAuth

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials) create an
   **OAuth client ID** (Web application).
2. Authorized JavaScript origins: `http://localhost:3000` (and your prod origin).
3. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://YOUR_PROD_DOMAIN/api/auth/callback/google`
4. Set in `.env`:

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_URL=http://localhost:3000
```

5. Allow-list each Gmail before they can sign in (exact address, lowercased):

```bash
npm run db:register-google -- you@gmail.com ADMIN "Your Name"
# or create via Admin → People (password optional for Google-only accounts)
```

Google Sign-In is allow-list only — it does **not** auto-create users. Password is optional
for Google-only accounts.

## Production deploy

Build and run like any Next.js app:

```bash
npm ci
npx prisma generate
npx prisma migrate deploy   # never `migrate dev` against production
npm run build
npm start                   # binds :3000; put a reverse proxy / PaaS router in front
```

Required in production, at minimum:

- `DATABASE_URL` pointing at your production Postgres (see Cloud SQL section below).
- `NEXTAUTH_URL` set to the real public HTTPS origin, and a freshly generated `NEXTAUTH_SECRET`
  (`openssl rand -base64 32` — do not reuse the dev value).
- A non-`console` `EMAIL_PROVIDER` (`resend` or `smtp`) if you want corrective-action emails to
  actually deliver; `console` just logs to stdout.
- `STORAGE_DRIVER=gcs` (with `GCS_BUCKET`, `GCS_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS`) if
  you're on a platform without a durable local filesystem (Cloud Run, most PaaS). The `local`
  driver writes under `LOCAL_UPLOAD_DIR` (`./public/uploads` by default) and requires a persistent
  volume if you use it in production.
- Change every `SEED_*` credential (or don't run `db:seed` against production at all — it's meant
  for demo/dev data).

## Google Cloud SQL (production)

Prefer `prisma migrate deploy` in CI/CD — never `migrate dev` against production.

### Auth Proxy (local against Cloud SQL)

```bash
./cloud-sql-proxy PROJECT:REGION:INSTANCE --port 5432
DATABASE_URL="postgresql://USER:PASS@127.0.0.1:5432/dpr_site_control?schema=public"
```

### Cloud Run / App Engine (Unix socket)

```bash
DATABASE_URL="postgresql://USER:PASS@localhost/dpr_site_control?host=/cloudsql/PROJECT:REGION:INSTANCE"
```

### Public IP

Authorize the client IP and append `?sslmode=require`.

Create a least-privilege DB user and a dedicated database. Point `DATABASE_URL` (and optional
`DIRECT_URL` for migrations behind a pooler) at that instance.

## Environment variables

See `.env.example` for the full list with placeholders. Notable:

| Var | Notes |
| --- | --- |
| `DATABASE_URL` | Required |
| `NEXTAUTH_SECRET` / `NEXTAUTH_URL` | Required |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional; enables the "Continue with Google" button |
| `EMAIL_PROVIDER` | `console` (default), `resend`, or `smtp` |
| `RESEND_API_KEY` | Required only when `EMAIL_PROVIDER=resend` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_SECURE` | Required only when `EMAIL_PROVIDER=smtp` |
| `STORAGE_DRIVER` | `local` (default) or `gcs` |
| `GCS_BUCKET` / `GCS_PROJECT_ID` / `GOOGLE_APPLICATION_CREDENTIALS` | Required only when `STORAGE_DRIVER=gcs` |
| `APP_TIMEZONE` | Used for "overdue" and date-boundary logic; defaults to `Asia/Kolkata` |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ENGINEER_EMAIL` / `SEED_ENGINEER_PASSWORD` / `SEED_SUPERVISOR_PASSWORD` | Only consumed by `npm run db:seed` |

`console` + `local` need no extra credentials — the app runs end-to-end with zero external
services for local dev/demo.

## Excel export

`GET /api/export/site/[siteId]?date=YYYY-MM-DD` or `?from=&to=` downloads a workbook aligned to
`Baijnath+Nitish.xlsx` (title merges, header block, `0.0%` on % complete, TOTAL LABOUR SUM formulas).

Documented deviations:

- Date cell uses `dd-mmm-yyyy` (source uses `mm-dd-yy`).
- Man-hours suggestion is `present × shift hours` (source sheet uses `(present × 8) + OT`);
  engineer-entered values are never overwritten.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `start` | Production |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Prisma migrate dev |
| `npm run db:deploy` | Prisma migrate deploy |
| `npm run db:seed` | Seed demo data |
| `npm test` | Vitest unit tests |

## Project layout

- `src/app` — routes (engineer `/sites`, admin `/admin`, `/my/corrective-actions`)
- `src/lib` — auth, fields, dashboard, excel, email, storage
- `prisma` — schema, migrations, seed

## Known gaps

See `REMAINING_WORK.md` for the original build plan; nearly all of it is implemented, including
photo attachments, admin management, field configuration, dashboards, corrective actions + email,
Excel export, PWA shell, and in-memory login rate limiting (`src/lib/rateLimit.ts`). Remaining
items to be aware of before a larger rollout:

- Login rate limiting is in-memory per process (`src/lib/rateLimit.ts`) — correct for a single
  instance but resets on redeploy and isn't shared across instances. Swap in a Redis-backed
  limiter (e.g. `@upstash/ratelimit`) before running more than one instance behind a load balancer.
- No committed authorization regression report (`docs/authz-check.md` from the plan's hardening
  step) — do a manual cross-site/cross-role spot check before go-live, per `REMAINING_WORK.md` §11.
- The local storage driver (`STORAGE_DRIVER=local`) writes to `public/uploads`, which is
  gitignored and not durable on most PaaS/container platforms — use `gcs` in production unless
  you're attaching a persistent volume.
