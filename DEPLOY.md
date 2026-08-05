# Production deploy — SiteWatch

Target stack: **Vercel** (Next.js) + **Supabase Postgres** + **NextAuth Google OAuth**.

Production build already passes (`npm run build`). Follow this checklist end-to-end.

## 1. Supabase (already done for this project)

- Migrations applied against project `okmzzztechihfkseuqzq`
- Keep using pooler URLs:
  - `DATABASE_URL` → port **6543** (transaction)
  - `DIRECT_URL` → port **5432** (session; used by `prisma migrate deploy` on Vercel)

Do **not** run `npm run db:seed` on a live production DB unless you want demo users/data.

## 2. Google OAuth (production URLs)

In [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
edit the existing OAuth client (`sitewatch-504617`) and **add** (keep localhost entries too):

| Field | Value |
| --- | --- |
| Authorized JavaScript origins | `https://YOUR_DOMAIN.vercel.app` |
| Authorized redirect URIs | `https://YOUR_DOMAIN.vercel.app/api/auth/callback/google` |

OAuth consent screen → add each real user Gmail as a **Test user** while the app is in Testing.

Allow-list each Gmail in the DB (from a machine that can reach Supabase):

```bash
npm run db:register-google -- you@gmail.com ADMIN "Your Name"
```

## 3. Deploy to Vercel

```bash
# From repo root (or connect the GitHub repo in the Vercel UI)
npx vercel link
npx vercel env pull   # optional
```

Or in the Vercel dashboard: **Add Project** → import `Anupamgt/SiteWatch` → set env vars → Deploy.

### Environment variables (Vercel → Settings → Environment Variables)

Copy from `.env.production.example`. Minimum:

| Name | Notes |
| --- | --- |
| `DATABASE_URL` | Supabase transaction pooler |
| `DIRECT_URL` | Supabase session pooler |
| `NEXTAUTH_URL` | `https://YOUR_DOMAIN.vercel.app` |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` (new value) |
| `GOOGLE_CLIENT_ID` | Same as local |
| `GOOGLE_CLIENT_SECRET` | Same as local |
| `EMAIL_PROVIDER` | `console` until Resend/SMTP is ready |
| `STORAGE_DRIVER` | `local` only if you accept no durable uploads; prefer `gcs` |
| `APP_TIMEZONE` | `Asia/Kolkata` |

`vercel.json` runs:

```bash
prisma generate && prisma migrate deploy && next build
```

## 4. Post-deploy smoke check

1. Open `https://YOUR_DOMAIN.vercel.app/login`
2. **Continue with Google** with an allow-listed Gmail
3. Admin → Sites / People / Corrective actions
4. Engineer flow: open a site report (use a membership user)
5. Confirm Excel export download works

## 5. Production hardening (before wider rollout)

- [ ] Rotate DB password if it was shared in chat
- [ ] Fresh `NEXTAUTH_SECRET` (not the local one)
- [ ] Do not seed demo passwords on prod; remove or disable seed accounts
- [ ] Set `EMAIL_PROVIDER=resend` (or smtp) for corrective-action mail
- [ ] Set `STORAGE_DRIVER=gcs` + bucket credentials for photo attachments
- [ ] Publish OAuth consent screen (or keep Testing + explicit test users)
- [ ] Custom domain → update `NEXTAUTH_URL` + Google origins/redirects

## 6. Rollback

Redeploy the previous Vercel deployment. DB migrations are forward-only; do not reset Supabase without a backup.
