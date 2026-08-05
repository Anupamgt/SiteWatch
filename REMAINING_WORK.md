# Remaining Work — DPR Site Control

Follow this file top to bottom. It is the execution plan for everything not yet built.
`ARCHITECTURE.md` remains the source of truth for the data model, routes, and the Excel mapping —
this file never contradicts it, it only sequences it and adds the concrete file paths, endpoint
shapes, and acceptance criteria.

**You (Sonnet) own both the backend and the UI.** There is no separate UI model on this project.
Build the engineer surface mobile-first and the admin surface desktop-first, exactly as described
in `ARCHITECTURE.md` §1.2, §4, and §6.

---

## 0. Ground rules

1. **Do not run `git commit`, `git add`, `git push`, or create branches.** `IMPLEMENTATION_ORDER.md`
   says "commit after each numbered step" — **ignore that instruction**. Leave every change in the
   working tree. The user will commit when they choose to.
2. Read `ARCHITECTURE.md` before each step; the section references below point at the exact part
   you need.
3. Every API route validates its body with **Zod** and re-checks authorization with
   `lib/auth-guards.ts`. Middleware is a convenience, never the security boundary.
4. After each step the app must still build: `npx tsc --noEmit` clean and `npm run build` clean.
   Run both before moving on.
5. Server Components by default. Use `"use client"` only where interaction demands it (forms,
   drag-reorder, autosave, file pickers).
6. Reuse what exists. Do not fork `getFieldDefinitions`, `StatusBadge`, `flattenRow`, or the date
   helpers — extend them in place.

### Local environment

Postgres runs in Docker (`docker-compose.yml` already exists and matches `.env`):

```bash
docker compose up -d          # postgres:16 on localhost:5432, db dpr_site_control, user/pass dpr/dpr
npx prisma migrate dev        # first run creates prisma/migrations/
npm run db:seed
npm run dev
```

Production uses **Google Cloud SQL** via `DATABASE_URL`; that is documented in the README you
write in Step 15 — do not put Cloud SQL config into `docker-compose.yml`.

---

## 1. Invariants — violating any of these is a bug

| # | Invariant | Where it bites |
| --- | --- | --- |
| I1 | `TaskRow.percentComplete` is a **fraction** (0.9333, 1.0625), never 0–100, and is **never clamped**. Recompute as `achievedQty / targetQty` only when the field is empty; a value the engineer typed always wins. | `lib/calculations.ts`, `DynamicField` PERCENT case, Excel column H |
| I2 | **System fields cannot be deleted.** `DELETE /api/sites/[siteId]/fields/[fieldId]` on a row with `isSystem = true` returns **400**. They may be hidden (`isActive=false`), relabelled, reordered, and toggled required. | Step 10 |
| I3 | `getFieldDefinitions(siteId, sectionType)` in `lib/fields.ts` is the **single source** of the effective field list. The form renderer, the Zod builder, the dashboard, and the Excel exporter all call it. Never hard-code a column list, not even in the exporter. | Steps 10, 11, 13 |
| I4 | Excel output must match `Baijnath+Nitish.xlsx` — merges, header cells, number formats, `TOTAL LABOUR` row. Coordinates are in §5 of this file (verified against the actual file). | Step 13 |
| I5 | `EMAIL_PROVIDER` defaults to **`console`**. The app must run end-to-end with zero mail credentials. Corrective-action creation returns **201 even when the send fails**. | Step 12 |
| I6 | An engineer may only read/write data for sites they hold a `SiteMembership` for, and may only write a section while it is `DRAFT`. Admins bypass membership. Every route re-checks; never trust a client-supplied id. | All steps |
| I7 | "Overdue" is **computed, never stored**: `status != CLOSED && dueDate != null && dueDate < startOfTodayInAppTimezone()`. Use `lib/dates.ts`, timezone `Asia/Kolkata`. | Steps 11, 12 |
| I8 | `totalManHours` is engineer-entered. Only suggest `actualPresent * site.standardShiftHours` when empty; never overwrite. | `lib/calculations.ts` |
| I9 | Header values on `Report` are a **snapshot** taken at creation. Editing a `Site` must not retro-change historical reports. | Step 2, Step 9 |
| I10 | Money/quantity maths uses Prisma `Decimal`; convert with `.toNumber()` only at the display/Excel edge. | Steps 11, 13 |

---

## 2. Step 0 — Unblock the build (do this first, nothing else compiles until it is done)

`npx tsc --noEmit` currently fails with 5 errors and no migration has ever been applied. Fix all
of it before writing a single new feature.

### 2.1 Apply the migration

- `docker compose up -d`
- `npx prisma migrate dev --name init` → creates `prisma/migrations/`.
- Add a **partial unique index** for global field definitions in the same migration (edit the
  generated SQL file, then re-run `prisma migrate dev`):

  ```sql
  CREATE UNIQUE INDEX "FieldDefinition_global_sectionType_key"
    ON "FieldDefinition"("sectionType", "key")
    WHERE "siteId" IS NULL;
  ```

  Reason: `@@unique([siteId, sectionType, key])` does **not** dedupe global rows, because Postgres
  treats `NULL`s as distinct. Without this index a re-run of the seed silently duplicates the
  entire global template and every form renders each field twice.

### 2.2 Fix `prisma/seed.ts:150` — `siteId: null` in a compound unique `where`

`prisma.fieldDefinition.upsert({ where: { siteId_sectionType_key: { siteId: null, … } } })` is a
type error (`Type 'null' is not assignable to type 'string'`) and is semantically wrong for the
reason above. Replace `seedFieldTemplate` with a `findFirst` + `create`/`update`:

```ts
const existing = await prisma.fieldDefinition.findFirst({
  where: { siteId: null, sectionType, key: f.key },
});
if (existing) await prisma.fieldDefinition.update({ where: { id: existing.id }, data: {...} });
else await prisma.fieldDefinition.create({ data: { siteId: null, isSystem: true, ... } });
```

Keep it idempotent. Verify: run `npm run db:seed` twice and confirm
`select count(*) from "FieldDefinition"` stays at 22.

### 2.3 Fix `src/app/layout.tsx:28` — `LayoutProps<"/">`

`LayoutProps` is a Next 16 generated global that only exists after `.next/types` is written, so a
cold `tsc --noEmit` fails. Replace with an explicit prop type:

```ts
export default function RootLayout({ children }: { children: React.ReactNode }) {
```

### 2.4 Fix the duplicated `RowValues` type (2 errors)

`src/lib/validation/rowSchema.ts` exports `RowValues = Record<string, unknown>` while
`src/components/DynamicRowForm.tsx` exports its own narrow `RowValues`. `flattenRow` returns the
loose one and `SectionEditor` wants the narrow one, so
`sites/[siteId]/reports/[date]/work-programme/page.tsx:38` and `.../labour/page.tsx:38` both fail.

- Create `src/types/rows.ts`:

  ```ts
  export type FieldValue = string | number | boolean | string[] | null | undefined;
  export type RowValues = Record<string, FieldValue>;
  export type EditableRow = RowValues & { id?: string; sortOrder?: number };
  ```

- Import it from `lib/rows.ts`, `lib/validation/rowSchema.ts`, `components/DynamicField.tsx`,
  `components/DynamicRowForm.tsx`, and `components/SectionEditor.tsx`. Delete the two local
  definitions (re-export from the old locations if that keeps the diff small).

### 2.5 Fix `src/lib/auth.ts:45`

`token.role = (user as { role: string }).role` conflicts with the augmented JWT type. Cast to the
Prisma `Role` union: `token.role = (user as { role: Role }).role;` (import `Role` as a type from
`@prisma/client`).

### 2.6 Fix the draft route writing `null` into non-nullable enum columns

`splitRowForPersistence` in `src/lib/rows.ts` does `systemData[f.key] = val === undefined ? null : val`
for **every** system field. `TaskRow.status` and `LabourRow.productivityCheck` are non-nullable
columns with defaults, so saving a draft where the engineer has not picked a status throws a
Prisma validation error and autosave dies.

Fix: keep a set of non-nullable system keys and omit them from `systemData` when the value is
`null`/`undefined`/`""` so the column default applies.

```ts
const NON_NULLABLE_SYSTEM_KEYS = new Set(["status", "productivityCheck", "sortOrder"]);
```

Also coerce `""` → `null` for nullable columns so an emptied text field clears rather than stores
an empty string.

### 2.7 Fix the row-ownership hole in the draft route (security)

`src/app/api/reports/[reportId]/sections/[type]/draft/route.ts` calls
`prisma.taskRow.update({ where: { id: row.id } })` with an id straight from the request body. Any
authenticated engineer can overwrite **any row in the database** by guessing an id.

Fix: before building the transaction, reject the request with 400 if any incoming `row.id` is not
in the section's own `existingIds` set. (Belt and braces: use `updateMany({ where: { id, sectionId: section.id } })`.)

### 2.8 Acceptance criteria for Step 0

- `npx tsc --noEmit` → 0 errors.
- `npm run build` → success.
- `prisma/migrations/` exists and `npx prisma migrate status` reports the DB up to date.
- `npm run db:seed` run twice leaves exactly 22 global `FieldDefinition` rows, 6 task rows, 5 labour rows.
- Logged in as the seeded engineer, opening a Work Programme draft, adding an empty row, and
  waiting 2s autosaves without a 500.
- A `PUT …/draft` carrying a `row.id` belonging to another section returns 400.

---

## 3. Step 8 — Photo attachments (IMPLEMENTATION_ORDER step 8)

Spec: `ARCHITECTURE.md` §2.1 (`Attachment`), §5 "Attachments", §9 (`STORAGE_DRIVER`).

### Files to create

| Path | Contents |
| --- | --- |
| `src/lib/storage/index.ts` | `getStorage(): StorageAdapter` dispatching on `process.env.STORAGE_DRIVER` (`local` default, `gcs`). Interface: `put(file: { buffer: Buffer; filename: string; mimeType: string }): Promise<{ url: string; storageKey: string }>` and `remove(storageKey: string): Promise<void>` |
| `src/lib/storage/local.ts` | Writes into `process.env.LOCAL_UPLOAD_DIR` (default `./public/uploads`), key `${yyyy}/${mm}/${cuid}.${ext}`, returns `/uploads/<key>` as the URL. `mkdir -p` on demand. |
| `src/lib/storage/gcs.ts` | Same interface using `@google-cloud/storage` + `GCS_BUCKET`. Lazy-import the SDK inside the function so a missing optional dependency never breaks the `local` path. |
| `src/app/api/uploads/route.ts` | `POST`, multipart via `await req.formData()`. |
| `src/app/api/task-rows/[taskRowId]/attachments/route.ts` | `GET` list, `POST` link `{ url, storageKey, filename, mimeType, sizeBytes }`. |
| `src/app/api/attachments/[attachmentId]/route.ts` | `DELETE` — removes the DB row and calls `storage.remove`. |
| `src/components/PhotoStrip.tsx` | Client component: thumbnail row, `<input type="file" accept="image/*" capture="environment" multiple>`, per-photo delete, upload progress, ≥44px targets. |

### Rules

- **Server-side** enforcement (never trust the client): allowed MIME `image/jpeg`, `image/png`,
  `image/webp`, `image/heic`; max **10 MB**. Reject with 400 and a clear message.
- Authorize by walking `taskRow → section → report → siteId` and calling `requireSiteAccess`.
  Uploading is only allowed while the section is `DRAFT`.
- `.gitignore` already ignores `/public/uploads`. The local driver must therefore `mkdir -p` the
  directory at runtime rather than relying on it existing in the checkout.
- Wire `PhotoStrip` into the expanded row body of `SectionEditor`, **Work Programme only**
  (`Attachment.taskRowId` is task-rows only). Replace the "Photo attachments coming soon."
  placeholder in `DynamicField.tsx`'s `PHOTO` case.
- A row must be persisted before it can hold photos. If the row has no `id` yet, flush a draft
  save first, then upload.
- Excel export carries **a count only**, never the image (`ARCHITECTURE.md` §2.1, §7.5).

### Acceptance

Upload a JPEG from a phone-sized viewport → thumbnail appears, `Attachment` row exists, file lands
in `public/uploads/…`. A 12 MB file and a `.pdf` are both rejected with 400. Delete removes both
the row and the file. An engineer from another site gets 403 on all three endpoints.

---

## 4. Step 9 — Admin management: sites, users, memberships (step 9)

Spec: `ARCHITECTURE.md` §4 (Admin routes), §5 (Sites & users). Desktop-first layout: max width
~1200px, real tables, sidebar or top nav — not the mobile card stack.

### Replace the stub

`src/app/admin/page.tsx` currently shows an amber "later phases" banner. Replace it with the
portfolio overview from §4: every site, today's submission compliance (both sections per site),
and the org-wide overdue corrective-action count. Add a persistent admin nav in
`src/app/admin/layout.tsx`: Overview · Sites · Users · Corrective Actions.

### Routes & files

| Page | File |
| --- | --- |
| `/admin/sites` | `src/app/admin/sites/page.tsx` — table + "New site" |
| `/admin/sites/new` | `src/app/admin/sites/new/page.tsx` |
| `/admin/sites/[siteId]/settings` | `src/app/admin/sites/[siteId]/settings/page.tsx` — edit + deactivate |
| `/admin/sites/[siteId]/members` | `src/app/admin/sites/[siteId]/members/page.tsx` |
| `/admin/users` | `src/app/admin/users/page.tsx` — list, create, edit, deactivate |

| API | File | Notes |
| --- | --- | --- |
| `GET/POST /api/sites` | `src/app/api/sites/route.ts` | `GET` returns the caller's sites for an engineer, all for an admin. `POST` is admin-only. |
| `GET/PATCH/DELETE /api/sites/[siteId]` | `src/app/api/sites/[siteId]/route.ts` | `DELETE` = soft delete (`isActive=false`) — never destroy reports. |
| `GET/POST /api/sites/[siteId]/members` | `src/app/api/sites/[siteId]/members/route.ts` | `POST { userId }` upserts the membership. |
| `DELETE /api/sites/[siteId]/members/[userId]` | `src/app/api/sites/[siteId]/members/[userId]/route.ts` | |
| `GET/POST /api/users` | `src/app/api/users/route.ts` | `POST` hashes with `bcryptjs` cost **12**. Never return `passwordHash` in any response. |
| `GET/PATCH/DELETE /api/users/[userId]` | `src/app/api/users/[userId]/route.ts` | `PATCH` may set a new password (re-hash). `DELETE` = `isActive=false`. |

- Site `code` is unique and short — validate `/^[A-Z0-9]{2,8}$/`, uppercase it, return 409 on a
  duplicate.
- Editing a `Site` must **not** touch existing `Report` header snapshots (I9).
- Add a Zod schema per route; put shared ones in `src/lib/validation/adminSchemas.ts`.

### Acceptance

Admin creates a site, creates an engineer, assigns them, and that engineer immediately sees the
site at `/sites`. Removing the membership makes `/sites/[siteId]` return 403. A deactivated user
cannot sign in. Hitting any `/api/sites` `POST` or `/api/users` route as an engineer returns 403.

---

## 5. Step 10 — Field configuration UI (step 10)

Spec: `ARCHITECTURE.md` §1.4, §5 "Field definitions". This is where invariants **I2** and **I3**
live.

### Files

- `src/app/admin/sites/[siteId]/fields/page.tsx` — Server Component: tabs for `WORK_PROGRAMME` /
  `LABOUR_DEPLOYMENT`, loads via `getFieldDefinitions(siteId, type)` **plus** the inactive rows
  (see below) and renders the client editor.
- `src/components/admin/FieldConfigEditor.tsx` — client: drag-to-reorder list, inline relabel,
  required/visible toggles, "Add custom field" modal, delete (custom only).
- `src/app/api/sites/[siteId]/fields/route.ts` — `GET ?sectionType=…` (resolved list),
  `POST` create custom field.
- `src/app/api/sites/[siteId]/fields/[fieldId]/route.ts` — `PATCH`, `DELETE`.
- `src/app/api/sites/[siteId]/fields/reorder/route.ts` — `PATCH { sectionType, orderedKeys: string[] }`.

### Behaviour

- `getFieldDefinitions` filters to `isActive = true`, which is right for rendering but wrong for
  the config screen (you must be able to un-hide a hidden field). Add a sibling in `lib/fields.ts`:
  `getFieldDefinitionsForAdmin(siteId, sectionType)` returning the same merge **without** the
  active filter, plus an `origin: "global" | "site"` marker per row. Do **not** loosen
  `getFieldDefinitions` itself — every renderer depends on its current contract (I3).
- **Editing a global row creates a site override**, it never mutates the global template. When
  `PATCH` targets a `FieldDefinition` with `siteId = null`, copy it to a new row with this
  `siteId` (same `key`, `isSystem`, `fieldType`) and apply the change there. Return the new id.
- `DELETE` on `isSystem = true` → `400 { error: "System fields cannot be deleted; hide it instead" }` (I2).
- `DELETE` on a custom field also strips the key from existing rows' `custom` JSON, or leaves it
  as orphaned data — pick "leave it" and say so in a code comment; do not silently rewrite history.
- Custom field creation: `key` must be camelCase, unique within `(siteId, sectionType)`, and must
  **not** collide with any system key. Reject with 409.
- **Reorder is one transaction**: `prisma.$transaction(orderedKeys.map((key, order) => …))`.
  Keys that currently resolve to a global row get materialised as site overrides inside the same
  transaction.
- Write an `AuditLog` row for every create / update / delete / reorder:
  `action: "field.create" | "field.update" | "field.delete" | "field.reorder"`,
  `entityType: "FieldDefinition"`.
- Use the browser's native HTML5 drag-and-drop or a small `pointerdown` handler; do **not** add a
  drag-and-drop dependency to `package.json`.

### Acceptance

Add a custom `SELECT` field "Shift" with options Day/Night → it appears on the engineer's Work
Programme form for that site only, saves into `TaskRow.custom.shift`, and shows up as column L in
the Excel export with header "Shift". Hide "Variance / Reason for Delay" → it disappears from the
form **and** from the export, and the remaining columns shift left. Reorder persists across a
reload. `DELETE` on `taskCode` returns 400. Another site's forms are unchanged throughout.

---

## 6. Step 11 — Per-site dashboard + read-only report view (step 11)

Spec: `ARCHITECTURE.md` §6 (exact tiles, tables, badge colours), §5 "Dashboard".

### Files

- `src/lib/dashboard.ts` — pure-ish aggregation: `getSiteDashboard(siteId, from, to)`. All Decimal
  maths stays in Decimal until the final `.toNumber()` (I10).
- `src/app/api/sites/[siteId]/dashboard/route.ts` — `GET ?from&to`, admin or site member.
- `src/app/admin/sites/[siteId]/page.tsx` — the dashboard page, default range = last 7 days,
  with a range picker.
- `src/app/admin/sites/[siteId]/reports/[date]/page.tsx` — read-only report view.
- `src/app/api/reports/[reportId]/sections/[type]/reopen/route.ts` — `POST`, **admin only**,
  `SUBMITTED → DRAFT`, writes `AuditLog { action: "section.reopen" }`.
- `src/app/api/reports/[reportId]/approve/route.ts` — `POST`, admin only, sets `approvedById` /
  `approvedAt`, writes `AuditLog { action: "report.approve" }`.
- `src/app/api/reports/[reportId]/route.ts` — **currently missing**: `GET` and `PATCH` for the
  report header (`siteEngineerName`, `siteSupervisorName`, `weatherCondition`). Without it a newly
  created report exports with an empty D6/F4/F5 header block. Also add a small header edit form to
  the engineer page `src/app/sites/[siteId]/reports/[date]/page.tsx`, which is read-only today.

### Tiles (all four, §6)

1. Reports submitted vs. expected (expected = calendar days in range).
2. Average `percentComplete` across task rows in range — remember it is a fraction (I1); format
   with `Intl.NumberFormat(…, { style: "percent" })`.
3. Open corrective actions, and how many of those are overdue (I7).
4. Labour: planned vs. actual headcount, total man-hours, absenteeism %
   (`1 - actualPresent/plannedStaff`).

### Tables (all three, §6)

Recent reports (date, engineer, both section statuses, task count, avg %, approval state) ·
task rows flagged `DELAYED` or `ON_HOLD` newest first · corrective actions with an overdue flag.

Use the existing `components/StatusBadge.tsx` everywhere; extend its map rather than writing new
colour logic. Also add `/admin` portfolio tiles reusing `getSiteDashboard` per site.

### Acceptance

With only seed data loaded, the dashboard for site `BIJ` over a range covering 2026-08-05 shows
both sections submitted for that day, an average % complete equal to the mean of the six seeded
task fractions, 1 open corrective action flagged overdue, and labour totals of 33 planned /
31 present / 310 man-hours. Reopening the Work Programme section lets the engineer edit it again and writes an
`AuditLog` row. Approving stamps `approvedAt` and the name then appears in Excel cell `F6`.

---

## 7. Step 12 — Corrective actions + email (step 12)

Spec: `ARCHITECTURE.md` §7 in full. Invariant **I5**.

### Email layer

| File | Contents |
| --- | --- |
| `src/lib/email/index.ts` | `sendEmail({ to, subject, html, text }): Promise<{ provider: string; messageId?: string; error?: string }>` — dispatches on `EMAIL_PROVIDER`, **defaults to `console`**. Never throws; returns the error. |
| `src/lib/email/console.ts` | `console.log`s the full message. Default driver so the app runs with no credentials. |
| `src/lib/email/resend.ts` | `resend` SDK + `RESEND_API_KEY`. |
| `src/lib/email/smtp.ts` | `nodemailer` + `SMTP_*`. |
| `src/lib/email/templates/correctiveAction.ts` | Returns `{ subject, html, text }`. Must contain: site name, report date, task reference (`taskCode` + `plannedWorkDescription`) when linked, title, HO guidance, priority, due date, and a deep link to `${NEXTAUTH_URL}/my/corrective-actions`. **Always send a plain-text alternative.** |

Every send writes an `EmailLog` row (`SENT` with `providerMessageId`, or `FAILED` with `error`).

### API

| Endpoint | File | Notes |
| --- | --- | --- |
| `GET /api/corrective-actions?siteId&status&overdue=true&assignedToId` | `src/app/api/corrective-actions/route.ts` | Engineers are force-scoped to `assignedToId = me`; ignore a spoofed param. `overdue=true` filters with I7. |
| `POST /api/corrective-actions` | same file | Validate that `assignedToId` is an `ENGINEER` **with a membership on `siteId`** (403 otherwise). Create with `status = OPEN`, send the email, log it, **return 201 even if the send failed**, with `{ action, email: { status, error? } }`. |
| `PATCH /api/corrective-actions/[id]` | `src/app/api/corrective-actions/[id]/route.ts` | Engineer (assignee) may only move `OPEN → IN_PROGRESS` and add a `closureNote`. Only an admin may set `CLOSED`, which stamps `closedAt`/`closedById`. `AuditLog` on every transition. |
| `POST /api/corrective-actions/[id]/resend-email` | `src/app/api/corrective-actions/[id]/resend-email/route.ts` | Admin only. New `EmailLog` row each attempt. |

### UI

- `src/app/admin/corrective-actions/page.tsx` — table with site / status / priority / overdue
  filters, last email status per row, resend button on failures.
- `src/app/admin/corrective-actions/new/page.tsx` — create form; pre-fill site/report/task when
  arriving from a dashboard "Raise action" link on a `DELAYED` row.
- `src/app/my/corrective-actions/page.tsx` — engineer, mobile-first cards, overdue first,
  "Start work" and "Propose closure" buttons. `/my/:path*` is already in the middleware matcher.
- Link "My corrective actions" from `/sites/[siteId]` (§4 says the site home shows them).

### Acceptance

With `EMAIL_PROVIDER=console` and no keys set: admin creates an action → 201, the rendered email
prints to stdout, an `EmailLog` row exists with `status = SENT`, and the engineer sees it at
`/my/corrective-actions`. Set `EMAIL_PROVIDER=resend` with a bogus key → still 201, `EmailLog`
is `FAILED` with the error text, the admin list shows the failure and resend works. Engineer
attempting `PATCH { status: "CLOSED" }` gets 403.

---

## 8. Step 13 — Excel export (step 13)

Spec: `ARCHITECTURE.md` §8. Invariants **I1**, **I3**, **I4**.

### Files

- `src/lib/excel/buildWorkbook.ts` — `buildReportWorkbook(reports: ReportWithRelations[], fieldsByType): ExcelJS.Workbook`.
  **Pure**: no Prisma, no `Response`. The route fetches, calls it, and streams
  `workbook.xlsx.writeBuffer()`.
- `src/app/api/export/site/[siteId]/route.ts` — `GET ?date=YYYY-MM-DD` (single day) or `?from&to`
  (one worksheet per date). Admin or site member.
- Download buttons on `/admin/sites/[siteId]` and `/admin/sites/[siteId]/reports/[date]`.

Response headers:
`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` and
`Content-Disposition: attachment; filename="DPR_<siteCode>_<date>.xlsx"`.

### Verified source layout

These were read back out of `/Users/rakeshkumar/Downloads/Baijnath+Nitish.xlsx` — treat them as
authoritative where they differ from prose in `ARCHITECTURE.md` (§12: "the workbook wins").

- Sheet name: the report date `YYYY-MM-DD`.
- Merges, exactly four: `A1:K1`, `A2:K2`, `A8:K8`, `A17:K17` (the second banner moves with the
  task-row count — see below).
- Column widths A→K: `18.43, 19.57, 34.86, 17.57, 15.71, 12.57, 20.86, 24, 16.86, 27, 30.14`.
- Row heights: row 1 = `21`, row 9 = `30`, row 18 = `45`, totals row = `15.75`.
- `A1` = `DAILY CONSTRUCTION SITE PROGRAMME & PROGRESS CONTROL REPORT` (bold, centred, ~14pt).
- `A2` = `Head Office Control & Monitoring Sheet | Site Engineer & Supervisor Daily Accountability Log`
  (italic, centred). Row 3 blank.
- Header block rows 4–6, labels bold in A/C/E and values in B/D/F, exactly as §8.3.
  `D4` is a **real `Date`**, not a string. Source `numFmt` is `mm-dd-yy`; write
  `numFmt: 'dd-mmm-yyyy'` per §8.3 (deliberate readability override — note it in the README).
  `E6` = `Approved By (HO):`, `F6` = `approvedBy?.name ?? ''`.
- Row 7 blank. `A8:K8` banner, bold white on a dark fill. Row 9 = headers, bold, light-grey fill.
- Task rows start at row 10. Quantity columns E and F use `numFmt: '#,##0'`.
- **Column H `numFmt` is `'0.0%'`** in the source (not `'0%'` as §8.4 prose says) and holds the
  **fraction** — `H13 = 1.0625` renders as `106.3%`. Do not clamp (I1). Write the literal value,
  not a formula.
- Column I is **title case** (`IN_PROGRESS` → `In Progress`); reuse `TASK_STATUS_LABELS` from
  `lib/constants.ts`.
- One blank row after the last task row, then the `2. DAILY LABOUR DEPLOYMENT & PRODUCTIVITY CONTROL`
  banner merged across A→K, then the labour header row (height 45), then the labour rows.
  Labour C/D/E/F use `numFmt: '#,##0'`; column J is title case.
- **`TOTAL LABOUR` row** immediately after the last labour row: `A` = `TOTAL LABOUR` (bold), and
  real `SUM()` formulas in **C, D, E, F only** — `{ formula: 'SUM(C19:C23)' }` style, with the
  range computed from the actual row span. B and G→K stay empty.
- All body cells: `alignment: { vertical: 'middle', wrapText: true }`, thin borders on table cells.

### Dynamic columns

Drive the whole column list from `getFieldDefinitions(siteId, sectionType)` (I3), using the A→K
mapping above as the default ordering:

- Hidden system fields are omitted and later columns shift left.
- Active custom fields append as columns L, M, … with `label` in the header row and
  `row.custom[key]` in the body.
- Attachments contribute **a count only** if a `PHOTO` field is active — never the image.
- Because the column letters move, compute the `SUM()` ranges and merge ranges from the resolved
  column indices; never hard-code `C19:C23`.

### Also fix in this step

`prisma/seed.ts` does **not** reproduce the source workbook rows (`ARCHITECTURE.md` §10.5 says
"exactly as in the source"). Aggregate labour totals happen to match (33 / 31 / 62 / 310) but the
per-row values and every task row differ. Update the seed to the real values so the export can be
diffed cell-for-cell against the source file:

- Tasks: TSK-01 Reinforcement Binding & Barbering, Bar Bender, 1500/1400 Kg, In Progress ·
  TSK-02 Shuttering & Formwork Assembly, Carpenter, 120/120 SqM, Completed ·
  TSK-03 Structural Steel Welding & Gusset Prep, Welder, 45/30 Joints, Delayed ·
  TSK-04 PCC Bed Brickwork & Masonry Edge, Mason, 80/85 CuM, Completed (`percentComplete = 1.0625`) ·
  TSK-05 Material Handling & Site Clearing, Helper, 1/1 LS, Completed ·
  TSK-06 Column Rebar Rigging & Plumb Alignment, Bar Bender, 6/4 Nos, In Progress.
  Locations, variance text, and HO guidance are in the source rows 10–15.
- Labour: Carpenter (Formwork) 6/6/12/60 · Mason (Brick/PCC) 4/4/8/40 · Welder (Structural)
  3/2/4/20 · Bar Bender (Rebar) 8/8/16/80 · Helper / Unskilled 12/11/22/110, contractors
  Apex Civil Ltd / TechSteel Sub as in source rows 19–23.

Note in a comment that the source's `totalManHours` is the formula `(present * 8) + OT`, whereas
`lib/calculations.ts` suggests `present * standardShiftHours` per §2.1. Keep the current
behaviour (it is only a suggestion, I8) — just document the difference.

### Acceptance

Export the seeded 2026-08-05 report and open it beside `Baijnath+Nitish.xlsx`: identical merges,
identical column widths, `D4` is a date, `H` shows `93.3% / 100.0% / 66.7% / 106.3% / 100.0% / 66.7%`,
labour totals row reads 33 / 31 / 62 / 310 from live `SUM()` formulas. Add a unit test asserting
those cell addresses and formats.

---

## 9. Step 14 — PWA + polish (step 14)

- `public/manifest.webmanifest`: `name` "DPR Site Control", `short_name` "DPR", `start_url` "/",
  `display` "standalone", `background_color`/`theme_color` `#0f172a`, icons 192 / 512 (maskable).
  Generate real PNG icons into `public/icons/`; the repo currently only has the Next.js sample SVGs.
- Link it from `src/app/layout.tsx` (`metadata.manifest`). `themeColor` is already set in `viewport`.
- Hand-rolled service worker at `public/sw.js` caching the **app shell only** (no API responses,
  never cache `POST`/`PUT`), registered from a small client component. Do not add `next-pwa`.
- Error/empty/loading states: `src/app/error.tsx`, `src/app/not-found.tsx`, `loading.tsx` for
  `/sites`, `/sites/[siteId]`, and the two section pages, plus `src/app/admin/error.tsx`.
- Mobile ergonomics audit on the engineer surface: ≥44px touch targets, `inputMode="decimal"` on
  numeric fields (already done in `DynamicField`), sticky save bar (already done in
  `SectionEditor`), and no horizontal scroll at 375px width.
- Fix `z.coerce.boolean()` in `lib/validation/rowSchema.ts` — the string `"false"` currently
  coerces to `true`. Use an explicit transform.

**Acceptance:** Lighthouse "Installable" passes; the app shell loads offline; a 375px viewport has
no horizontal scroll on any engineer page.

---

## 10. Step 15 — README (step 15)

Create `README.md` at the project root covering:

1. **What it is** — two personas, one report per site-day with two independently submitted sections.
2. **Local setup** — `docker compose up -d`, `cp .env.example .env`, `npx prisma migrate dev`,
   `npm run db:seed`, `npm run dev`, plus the seeded logins
   (`admin@example.com` / `admin123`, `engineer@example.com` / `engineer123`, `nitish@example.com`).
3. **Prisma 6 pin** — why (`ARCHITECTURE.md` §1.1) and that `npm i prisma` resolves to v7 and breaks.
4. **Google Cloud SQL guide** (`ARCHITECTURE.md` §9), all three paths:
   - Local dev via the Cloud SQL Auth Proxy —
     `./cloud-sql-proxy PROJECT:REGION:INSTANCE --port 5432`, then
     `DATABASE_URL="postgresql://USER:PASS@127.0.0.1:5432/dpr?schema=public"`.
   - Cloud Run / App Engine via Unix socket —
     `DATABASE_URL="postgresql://USER:PASS@localhost/dpr?host=/cloudsql/PROJECT:REGION:INSTANCE"`.
   - Direct public IP — authorise the client IP and append `?sslmode=require`.
   - Plus: creating the instance and database, creating a least-privilege DB user, and that
     **production runs `prisma migrate deploy`, never `migrate dev`**.
5. **Environment variables** — table mirroring `.env.example`, marking which are required per
   `EMAIL_PROVIDER` / `STORAGE_DRIVER` choice, and stating that `console` + `local` need nothing.
6. **Excel export** — how it maps to `Baijnath+Nitish.xlsx` and the two documented deviations
   (the `dd-mmm-yyyy` date format vs. the source's `mm-dd-yy`; `totalManHours` suggested as
   `present × shift hours` while the source sheet computes `(present × 8) + OT`).
7. **Project layout** and the `npm run` script table.

---

## 11. Step 16 — Hardening (light pass)

Keep this proportionate — a focused pass, not a full test suite.

- **Authorization pass.** Sign in as `nitish@example.com`, create a second site the user is not a
  member of, and confirm 403 on: `GET /api/sites/[otherId]`, `GET/PUT` that site's section
  endpoints, `POST /api/uploads` against its task rows, `GET /api/export/site/[otherId]`,
  `GET /api/sites/[otherId]/dashboard`, and every `/admin/*` page and admin API.
  Record the results in a short `docs/authz-check.md`.
- **Login rate limiting.** In-memory sliding window in `src/lib/rateLimit.ts` (5 attempts per
  email+IP per 15 minutes), applied inside the Credentials `authorize` callback. Note in the
  README that a multi-instance deployment needs Redis instead.
- **Unit tests.** Add `vitest` (dev dependency) plus an `npm test` script and cover exactly three
  things:
  1. `getFieldDefinitions` — site rows override globals by key, inactive rows are filtered,
     ordering is `order` then `key`.
  2. `withDefaultPercentComplete` — computes `achieved/target`, keeps a manual value, does **not**
     clamp `85/80 = 1.0625`, and leaves it null when `targetQty = 0`.
  3. `buildReportWorkbook` — the cell assertions from §8 above.
  Keep them pure; do not require a live database.

---

## 12. Definition of done for the whole remaining scope

- `npx tsc --noEmit` and `npm run build` both clean.
- `docker compose up -d && npx prisma migrate dev && npm run db:seed && npm run dev` works from a
  clean checkout with only `.env.example` copied to `.env`.
- An engineer can complete a full day on a phone: pick site → pick date → edit the header → fill
  both sections with photos → autosave → submit → see corrective actions assigned to them.
- An admin can, on desktop: create a site and users, assign members, reconfigure fields, read the
  dashboard, approve/reopen a report, raise a corrective action that emails via the console
  driver, and download an `.xlsx` that matches `Baijnath+Nitish.xlsx`.
- No `git commit` has been run.
