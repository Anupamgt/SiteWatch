# SiteWatch

Daily Progress Report system for construction sites. Site engineers file reports from a phone;
head-office admins configure sites/fields, review dashboards, raise corrective actions (email),
and export Excel workbooks matching `Baijnath+Nitish.xlsx`.

One **Report** per site per calendar day holds a shared header and two independently drafted /
submitted sections: **Work Programme** and **Labour Deployment**.

## Redis cache + secure cookies

### Cookies (NextAuth)

Session cookies are configured in `src/lib/auth.ts`:
- `httpOnly`, `sameSite=lax`
- `__Secure-` / `__Host-` prefixes + `secure` when `NEXTAUTH_URL` is HTTPS (production)

### Redis (Upstash)

1. Create a free DB at [console.upstash.com](https://console.upstash.com)
2. Copy **REST URL** + **REST TOKEN** into `.env` / Vercel:

```bash
UPSTASH_REDIS_REST_URL="https://….upstash.io"
UPSTASH_REDIS_REST_TOKEN="…"
```

Used for:
- Shared **login rate limiting** across Vercel instances
- **Field-definition cache** (5 min TTL; invalidated on admin field edits)

If unset, the app uses an in-memory fallback (fine for single-instance local/dev).

Health check (admin session): `GET /api/admin/cache-health`

## Roles

| Role | Access |
| --- | --- |
| `ADMIN` | Full head-office: sites, people, dashboards, corrective actions |
| `ENGINEER` | Assigned sites only — file work programme / labour reports |
| `SUPERVISOR` | Assigned sites like engineers — **cannot** open People / org directory (`/admin/users`) |

Create supervisors in **Admin → People** (role: Site supervisor) and assign site memberships.

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

## Supabase (PostgreSQL) + Google OAuth

SiteWatch uses **Supabase only as Postgres**. Auth stays on **NextAuth** (not Supabase Auth).

### 1. Wire Supabase

1. Supabase dashboard → your project → **Project Settings → Database**.
2. Copy connection strings:
   - **Transaction pooler** (port `6543`) → `DATABASE_URL`
   - **Session pooler** or **Direct** (port `5432`) → `DIRECT_URL`
3. Put them in `.env` (add `?schema=public` and `sslmode=require` if missing):

```bash
DATABASE_URL="postgresql://postgres.PROJECT:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&schema=public"
DIRECT_URL="postgresql://postgres.PROJECT:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require&schema=public"
```

4. Apply schema + optional demo data:

```bash
npx prisma migrate deploy
npm run db:seed
```

### 2. Wire Google OAuth

1. [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) → **Create OAuth client ID** (Web application).
2. **Authorized JavaScript origins:** `http://localhost:3000`
3. **Authorized redirect URIs:** `http://localhost:3000/api/auth/callback/google`
4. In `.env`:

```bash
GOOGLE_CLIENT_ID="....apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-..."
NEXTAUTH_URL="http://localhost:3000"
```

5. Allow-list your Gmail (exact address), then restart `npm run dev`:

```bash
npm run db:register-google -- you@gmail.com ADMIN "Your Name"
```

Google Sign-In is allow-list only — it does **not** auto-create users. Password is optional
for Google-only accounts.

## Corrective-action email

Creating an action (Admin → Corrective actions → New) emails the assigned engineer.
Provider is selected with `EMAIL_PROVIDER` (`console` | `resend` | `smtp`).

### Option A — Resend (best for Vercel)

1. Create an API key at [resend.com](https://resend.com)
2. In `.env` (and Vercel env):

```bash
EMAIL_PROVIDER="resend"
MAIL_FROM="SiteWatch <onboarding@resend.dev>"   # or your verified domain
RESEND_API_KEY="re_..."
```

3. Test:

```bash
npm run email:test -- you@gmail.com
```

### Option B — Gmail SMTP

1. Google Account → Security → enable 2-Step Verification → create an **App password**
2. In `.env`:

```bash
EMAIL_PROVIDER="smtp"
MAIL_FROM="SiteWatch <you@gmail.com>"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="you@gmail.com"
SMTP_PASSWORD="your-16-char-app-password"
SMTP_SECURE="false"
```

3. `npm run email:test -- engineer@example.com`

Failed sends still create the action (HTTP 201) and show **FAILED** in the admin list with **Resend email**.

**Preferred path:** Vercel + Supabase. See **[DEPLOY.md](./DEPLOY.md)** for the full checklist
(Google OAuth production redirects, env vars, smoke tests).

Quick start:

```bash
npm ci
npm run build              # local verify
# On Vercel, vercel.json runs: prisma generate && prisma migrate deploy && next build
```

Required in production, at minimum:

- `DATABASE_URL` / `DIRECT_URL` → Supabase poolers (see `.env.production.example`)
- `NEXTAUTH_URL` = public HTTPS origin; fresh `NEXTAUTH_SECRET` (`openssl rand -base64 32`)
- Google OAuth client with production origin + `/api/auth/callback/google` redirect
- `EMAIL_PROVIDER=resend` or `smtp` when you need real corrective-action email (`console` only logs)
- `STORAGE_DRIVER=gcs` on Vercel/Cloud Run (local disk is not durable)
- Do not run `db:seed` against a live prod DB unless you intentionally want demo accounts

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
