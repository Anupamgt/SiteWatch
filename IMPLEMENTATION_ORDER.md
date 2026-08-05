# Implementation Order

Follow these steps in order. Read `ARCHITECTURE.md` first — it is the source of truth for the
data model, routes, and Excel mapping. Each step should end with the app in a runnable state.

**Ground rules**
- Do not invent fields or rename the DPR columns. The source workbook layout in
  `ARCHITECTURE.md` §8 is exact; match it.
- Validate every API body with Zod and re-check authorization inside every route handler.
- Commit after each numbered step.

---

1. **Scaffold the app.** `create-next-app` with TypeScript, Tailwind, App Router, `src/`.
   Install `prisma@^6 @prisma/client@^6 next-auth@^4 bcryptjs zod exceljs resend nodemailer date-fns clsx tsx`.
   **Pin Prisma to 6.x** — v7 removed `url` from the datasource block and the committed schema
   will not parse under it.
   Add `.env.example` (copy from `ARCHITECTURE.md` §9) and gitignore `.env` and `/public/uploads`.

2. **Prisma client + migration.** Add the `lib/prisma.ts` singleton (guard against hot-reload
   connection leaks). Run `prisma migrate dev --name init` against `prisma/schema.prisma`.
   Verify the schema applies cleanly before writing any UI.

3. **Seed.** Write `prisma/seed.ts` per `ARCHITECTURE.md` §10 — users, the Bijapur/BRIJ site,
   the **global FieldDefinition template for both section types**, and the sample report with six
   task rows and five labour rows. Make it idempotent with `upsert`. Nothing downstream renders
   until the field template exists, so do not skip it.

4. **Auth.** NextAuth credentials provider with JWT sessions, `lib/auth.ts`, the
   `types/next-auth.d.ts` role augmentation, `middleware.ts`, and `lib/auth-guards.ts`
   (`requireUser`, `requireAdmin`, `requireSiteAccess`). Build `/login` and the role-based
   redirect from `/`. Confirm an engineer is blocked from `/admin`.

5. **Field engine.** `lib/fields.ts` → `getFieldDefinitions(siteId, sectionType)` merging global
   defaults with site overrides. Then `lib/validation/rowSchema.ts` to build a Zod schema from
   that list at runtime, and the `DynamicField` / `DynamicRowForm` components. Every consumer —
   form, API validator, Excel exporter — must call `getFieldDefinitions`, never a hard-coded list.

6. **Report APIs.** `POST /api/reports` (idempotent upsert on site+date), section read, section
   draft `PUT` (full row replace in one transaction), and section `submit`. Enforce that
   engineers can only write to `DRAFT` sections on sites they belong to.

7. **Engineer UI.** `/sites`, `/sites/[siteId]`, `/sites/[siteId]/reports/[date]`, and the two
   section pages. Add debounced autosave (~2s) plus an explicit "Save draft" button, and a submit
   confirmation. Mobile first: large touch targets, `inputMode="decimal"` on quantity fields,
   sticky action bar.

8. **Photo attachments.** Storage adapter (`local` driver first, GCS behind the same interface),
   `POST /api/uploads` with server-side MIME and 10 MB checks, attachment link/delete endpoints,
   and a thumbnail strip on task rows.

9. **Admin management.** Site CRUD, user CRUD, and site membership assignment screens.

10. **Field configuration UI.** `/admin/sites/[siteId]/fields` — add custom fields, relabel and
    hide system fields, drag to reorder persisting via the `reorder` endpoint in one transaction.
    System fields must not be deletable.

11. **Dashboard.** `/admin/sites/[siteId]` with the tiles, tables, shared `StatusBadge`, and
    computed overdue flags from `ARCHITECTURE.md` §6. Add the read-only report view with approve
    and reopen-section actions.

12. **Corrective actions + email.** Email provider abstraction with the `console` driver as the
    default so the app runs with no mail credentials. Create → send → write `EmailLog`; return 201
    even when sending fails, and expose a resend button. Build the admin list with filters and the
    engineer `/my/corrective-actions` view with open → in-progress → closed transitions.

13. **Excel export.** `lib/excel/buildWorkbook.ts` as a pure function per `ARCHITECTURE.md` §8,
    then the single-date and date-range routes with download buttons. Diff the output against
    `Baijnath+Nitish.xlsx`: merged title rows, header block cells A4–F6, the `0%` number format on
    column H, and the `TOTAL LABOUR` row summing only C–F.

14. **PWA + polish.** Manifest, icons, service worker for the app shell, loading/empty/error
    states, `error.tsx` and `not-found.tsx`.

15. **README.** Local setup plus the Google Cloud SQL connection guide (Auth Proxy for local,
    Unix socket for Cloud Run, public IP with `sslmode=require`), and a note that production runs
    `prisma migrate deploy`.

16. **Hardening.** Authorization pass proving an engineer cannot reach another site's data by
    guessing an id, login rate limiting, and unit tests for `getFieldDefinitions`, the
    percent-complete calculation (including the >100% case), and workbook building.
