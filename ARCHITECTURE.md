# DPR Site Control — Architecture & Build Specification

Daily Progress Report (DPR) system for construction sites. Site engineers file daily reports
from their phone; head-office administrators configure sites, review progress, issue corrective
actions by email, and export a workbook that matches the existing `Baijnath+Nitish.xlsx` DPR.

This document is the single source of truth for the implementing agent. Read it fully before
writing code, and follow `IMPLEMENTATION_ORDER.md` for sequencing.

---

## 1. System Overview

### 1.1 Stack

| Concern | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js (App Router) + TypeScript | Server Components by default, Server Actions for mutations where practical |
| Styling | Tailwind CSS | Mobile-first; `sm:`/`lg:` breakpoints promote to desktop admin |
| Database | PostgreSQL on Google Cloud SQL | Accessed via `DATABASE_URL` |
| ORM | Prisma **6.x (pinned)** | Schema in `prisma/schema.prisma`; see the version note below |
| Auth | NextAuth v4, Credentials provider, JWT session strategy | Roles `ENGINEER` \| `ADMIN` |
| Email | Pluggable: Resend (default) or nodemailer SMTP | Selected by `EMAIL_PROVIDER` |
| Excel | `exceljs` | Streams an `.xlsx` matching the source DPR layout |
| File storage | Pluggable: local disk (dev) or Google Cloud Storage (prod) | Task-row photos |
| PWA | `manifest.json` + service worker (`next-pwa` or hand-rolled) | Installable, offline shell only |

> **Pin Prisma to 6.x.** Prisma 7 removed `url = env("DATABASE_URL")` from the datasource block,
> requiring a `prisma.config.ts` plus a driver adapter passed to the `PrismaClient` constructor.
> The committed schema uses the v6 form and has been validated against `prisma@6`. Install
> `prisma@^6` and `@prisma/client@^6` explicitly; a bare `npm i prisma` resolves to v7 and the
> schema will not parse. Upgrading is a deliberate follow-up task, not part of the MVP.

### 1.2 Two personas, two surfaces

**Site Engineer (mobile).** Signs in, picks one of their assigned sites, picks a date, picks a
report section (Work Programme or Labour Deployment), fills a dynamically-rendered form, saves a
draft as often as they like, then submits. They can attach photos to task rows and see corrective
actions assigned to them.

**Administrator (desktop).** Manages sites and users, configures which fields appear on each
site's forms (add / remove / reorder), reviews submitted reports on a per-site dashboard, raises
corrective actions that email the responsible engineer, tracks those actions open→closed, and
exports Excel.

### 1.3 The central modelling decision: one report per site-day, two sections

The source spreadsheet is a **single sheet containing both report types under one shared header**.
The engineer workflow, however, asks the user to "select a report type". These are reconciled as:

- `Report` — one row per `(site, date)`. Owns the shared header (project name, engineer,
  supervisor, weather, etc.).
- `ReportSection` — one row per `(report, sectionType)`, where `sectionType` is
  `WORK_PROGRAMME` or `LABOUR_DEPLOYMENT`. Carries its own `DRAFT`/`SUBMITTED` status so the two
  sections can be filled and submitted independently.
- `TaskRow` / `LabourRow` — the line items, each hanging off its section.

Export therefore renders both sections into one worksheet exactly like the source file, while the
engineer still experiences "pick a report type and fill it in". A `Report` is created lazily the
first time either section is opened for that site-date.

### 1.4 The second modelling decision: hybrid fixed + dynamic fields

Admins must be able to add, remove, and reorder fields **per site and per report type**, but the
dashboard and the Excel export depend on specific fields existing with known types. A fully
schema-less `Json` blob would make aggregation and export fragile; fully rigid columns would make
the admin feature impossible. The design is therefore a hybrid:

- **System fields** are real, typed Prisma columns (`targetQty`, `achievedQty`, `status`, …).
  They back the dashboard, the productivity maths, and the Excel export. Admins may **hide**,
  **relabel**, and **reorder** them, and may toggle `required`, but may not delete them. Hiding a
  system field means it is not rendered or exported for that site; the column stays in the table.
- **Custom fields** are admin-created and stored in a `custom Json` map on `TaskRow` /
  `LabourRow`, keyed by `FieldDefinition.key`. They render after (or interleaved with, per
  `order`) system fields and are exported as extra columns appended to the right of column K.

`FieldDefinition` rows drive rendering, validation, and export ordering for both kinds. A
`FieldDefinition` with `siteId = null` is a **global default template**; a row with a `siteId` is
a site-level override. Effective field list for a site =
`site-specific rows` ∪ `global rows whose key is not overridden`, filtered to `active = true`,
sorted by `order`, then `key`.

> Implementation note: put this resolution in one place — `lib/fields.ts` →
> `getFieldDefinitions(siteId, sectionType)` — and have the form renderer, the API validator, and
> the Excel exporter all call it. Never re-derive it inline.

### 1.5 Request flow

```
Engineer (mobile PWA)
  └─ /sites → /sites/[siteId]/reports/[date] → /…/work-programme | /…/labour
       ├─ GET  field definitions + existing draft   (Server Component, direct Prisma read)
       ├─ POST /api/reports/[reportId]/sections/[type]/draft   (autosave, debounced)
       ├─ POST /api/uploads                                    (photo → storage adapter)
       └─ POST /api/reports/[reportId]/sections/[type]/submit  (validate → SUBMITTED)

Admin (desktop)
  └─ /admin/sites/[siteId] → dashboard aggregates
       ├─ /admin/sites/[siteId]/fields         → CRUD + reorder FieldDefinition
       ├─ /admin/corrective-actions            → create → queues email → OPEN
       └─ GET /api/export/site/[siteId]?from&to → exceljs stream → .xlsx download
```

---

## 2. Data Model

Full Prisma source lives in `prisma/schema.prisma`. This section explains intent; the schema file
is authoritative for syntax.

### 2.1 Entities

**`User`** — `id`, `email` (unique), `name`, `passwordHash` (bcrypt, 12 rounds), `role`
(`ENGINEER` | `ADMIN`), `phone`, `isActive`, timestamps. Credentials auth only, so no NextAuth
`Account`/`Session`/`VerificationToken` tables are needed (JWT strategy).

**`Site`** — `id`, `name`, `code` (unique, short, e.g. `BIJ`), `projectName` (e.g. "BRIJ
Project"), `locationZone`, `contractorClient`, `isActive`, timestamps. The header defaults for a
new report are copied from here.

**`SiteMembership`** — join table `(userId, siteId)` with unique compound key. Determines which
sites an engineer sees. Admins implicitly see all sites; do not require memberships for them.

**`Report`** — `id`, `siteId`, `reportDate` (`@db.Date`), header snapshot fields
(`projectName`, `locationZone`, `contractorClient`, `siteEngineerName`, `siteSupervisorName`,
`weatherCondition`, `dayOfWeek`), `approvedById`, `approvedAt`, `createdById`, timestamps.
Unique on `(siteId, reportDate)`.

> Header values are **snapshotted** onto the report at creation rather than joined from `Site`,
> because a historical DPR must keep the contractor/engineer names that were true on that day.
> `dayOfWeek` is likewise stored (not derived at render time) to avoid timezone drift.

**`ReportSection`** — `id`, `reportId`, `type` (`WORK_PROGRAMME` | `LABOUR_DEPLOYMENT`),
`status` (`DRAFT` | `SUBMITTED`), `submittedById`, `submittedAt`, `lastSavedAt`, timestamps.
Unique on `(reportId, type)`. This is what "draft save / resume" hangs off: an engineer returning
to a site-date sees the section's existing rows and continues.

**`TaskRow`** (Report type 1) — `id`, `sectionId`, `sortOrder`, `taskCode` ("TSK-01"),
`locationStructure`, `plannedWorkDescription`, `primaryTradeLead`, `targetQty` (`Decimal`),
`achievedQty` (`Decimal`), `unit`, `percentComplete` (`Float`, **stored as a fraction 0..1+**),
`status` (`TaskStatus`), `varianceReason`, `correctiveActionNote`, `custom Json`, timestamps.

> `percentComplete` is a fraction, not 0–100. The source workbook stores `0.93333…` with a percent
> number format, and cell `H13` is `1.0625` — targets can be exceeded, so **do not clamp to 1**.
> Recompute on save as `achievedQty / targetQty` when both are present and `targetQty > 0`, but
> allow manual override (keep the user's value if they edited the field directly).

**`LabourRow`** (Report type 2) — `id`, `sectionId`, `sortOrder`, `labourCategory`,
`contractorGangLeader`, `plannedStaff` (`Int`), `actualPresent` (`Int`), `otHours` (`Decimal`),
`totalManHours` (`Decimal`), `assignedWorkArea`, `outputDeliveredToday`, `targetStdRate`,
`productivityCheck` (`ProductivityCheck`), `supervisorRemarks`, `custom Json`, timestamps.

> `totalManHours` in the sample is **not** `actualPresent × 8 + otHours` (row 19: 6 present,
> 12 OT, 60 man-hours = 6 × 10). Treat it as an engineer-entered figure with a suggested default
> of `actualPresent * standardShiftHours` (`standardShiftHours` defaults to 8, configurable per
> site later). Never silently overwrite what the engineer typed.
> `targetStdRate` is free text ("20 SqM / Man-Day", "N/A") — keep it a `String`, not a number.

**`FieldDefinition`** — `id`, `siteId` (nullable → global template), `sectionType`, `key`,
`label`, `fieldType` (`FieldType`), `order`, `isSystem`, `isRequired`, `isActive`, `options`
(`String[]`, for select/multiselect), `placeholder`, `helpText`, `defaultValue`, timestamps.
Unique on `(siteId, sectionType, key)`.

**`Attachment`** — `id`, `taskRowId`, `url`, `storageKey`, `filename`, `mimeType`, `sizeBytes`,
`uploadedById`, `createdAt`. Optional, many-per-task-row. Photos are **not** written into the
Excel export in the MVP (only a count); see §7.5.

**`CorrectiveAction`** — `id`, `siteId`, `reportId?`, `taskRowId?`, `title`, `description`,
`guidance`, `status` (`OPEN` | `IN_PROGRESS` | `CLOSED`), `priority` (`LOW` | `MEDIUM` | `HIGH` |
`CRITICAL`), `dueDate`, `assignedToId` (engineer), `createdById` (admin), `closedAt`,
`closedById`, `closureNote`, timestamps.

> **Overdue is computed, never stored**: `status != CLOSED && dueDate != null && dueDate < today`.
> A stored boolean would go stale without a cron job.

**`EmailLog`** — `id`, `correctiveActionId?`, `to`, `subject`, `provider`, `status`
(`QUEUED` | `SENT` | `FAILED`), `providerMessageId`, `error`, `sentAt`, `createdAt`. Every
outbound email is logged so the admin UI can show delivery state and support retry.

**`AuditLog`** — `id`, `actorId`, `action`, `entityType`, `entityId`, `metadata Json`,
`createdAt`. Written for field-definition changes, submissions, approvals, and corrective-action
state transitions.

### 2.2 Enums

`Role`, `SectionType`, `SectionStatus`, `TaskStatus` (`NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`,
`DELAYED`, `ON_HOLD`), `ProductivityCheck` (`LOW`, `NORMAL`, `HIGH`, `NOT_APPLICABLE`),
`FieldType` (`TEXT`, `TEXTAREA`, `NUMBER`, `DECIMAL`, `DATE`, `SELECT`, `MULTISELECT`, `BOOLEAN`,
`PERCENT`, `PHOTO`), `CorrectiveActionStatus`, `Priority`, `EmailStatus`.

### 2.3 Indexes worth having

- `Report`: `@@unique([siteId, reportDate])`, `@@index([siteId, reportDate])`
- `ReportSection`: `@@unique([reportId, type])`
- `TaskRow` / `LabourRow`: `@@index([sectionId, sortOrder])`
- `CorrectiveAction`: `@@index([siteId, status])`, `@@index([assignedToId, status])`,
  `@@index([status, dueDate])` — backs the overdue query
- `FieldDefinition`: `@@index([siteId, sectionType, order])`

### 2.4 Cascade rules

`Report → ReportSection → TaskRow/LabourRow → Attachment` all cascade on delete.
`CorrectiveAction.taskRowId` is `onDelete: SetNull` — deleting a task row must not destroy the
audit trail of an action raised against it.

---

## 3. Auth Model

- **Provider**: NextAuth Credentials (`email` + `password`), `session.strategy = "jwt"`.
- **Password hashing**: `bcryptjs`, cost 12. Never store or log plaintext.
- **JWT claims**: `sub` (user id), `role`, `name`, `email`. Extend the `Session`/`JWT` types in
  `types/next-auth.d.ts` so `session.user.role` is typed.
- **Route protection**: `middleware.ts` matcher on `/sites/:path*`, `/admin/:path*`, `/api/:path*`
  (excluding `/api/auth`). Unauthenticated → `/login`. `ENGINEER` hitting `/admin/*` → 403 page.
- **Authorization helpers** in `lib/auth-guards.ts`:
  - `requireUser()` → session or throw 401
  - `requireAdmin()` → session with `role === "ADMIN"` or throw 403
  - `requireSiteAccess(siteId)` → admin passes; engineer must have a `SiteMembership`
- **Every API route re-checks authorization server-side.** Middleware is a convenience, not the
  security boundary. In particular, an engineer must not be able to read or write a report for a
  site they are not a member of by guessing an id.
- Engineers may edit a section only while it is `DRAFT`. Once `SUBMITTED`, edits require an admin
  (who can reopen a section back to `DRAFT`, recorded in `AuditLog`).

---

## 4. Page Routes

### Public / shared
| Route | Purpose |
| --- | --- |
| `/login` | Credentials sign-in |
| `/` | Redirect: `ADMIN` → `/admin`, `ENGINEER` → `/sites` |

### Engineer (mobile-first)
| Route | Purpose |
| --- | --- |
| `/sites` | Cards of assigned sites; each shows today's submission state |
| `/sites/[siteId]` | Site home: date picker, recent reports, my open corrective actions |
| `/sites/[siteId]/reports/[date]` | Report header form + two section tiles with status |
| `/sites/[siteId]/reports/[date]/work-programme` | Dynamic task-row form, add/remove rows, photos |
| `/sites/[siteId]/reports/[date]/labour` | Dynamic labour-row form |
| `/my/corrective-actions` | Actions assigned to me; mark in-progress, propose closure |

`[date]` is `YYYY-MM-DD`. Validate the format and reject anything else rather than letting an
invalid string reach Prisma.

### Admin (desktop)
| Route | Purpose |
| --- | --- |
| `/admin` | Portfolio overview: all sites, today's submission compliance, overdue action count |
| `/admin/sites` | Site list + create |
| `/admin/sites/[siteId]` | Per-site dashboard (§6) |
| `/admin/sites/[siteId]/fields` | Field configuration: add / remove / reorder, per section type |
| `/admin/sites/[siteId]/members` | Assign engineers to the site |
| `/admin/sites/[siteId]/reports/[date]` | Read-only report view, approve, reopen section |
| `/admin/users` | User CRUD, role assignment, deactivate |
| `/admin/corrective-actions` | All actions, filter by site / status / overdue |
| `/admin/corrective-actions/new` | Create action, pick assignee, send email |

---

## 5. API Routes

All under `/app/api`. JSON in, JSON out. Validate every body with **Zod**; return
`{ error: string, details?: ZodIssue[] }` with the right status code. Never trust client-supplied
ids without an ownership check.

### Auth
- `POST /api/auth/[...nextauth]` — NextAuth handler

### Sites & users (admin)
- `GET /api/sites` — list (engineer: own sites only)
- `POST /api/sites` — create
- `GET|PATCH|DELETE /api/sites/[siteId]`
- `GET|POST /api/sites/[siteId]/members`
- `DELETE /api/sites/[siteId]/members/[userId]`
- `GET|POST /api/users`, `GET|PATCH|DELETE /api/users/[userId]`

### Field definitions (admin)
- `GET /api/sites/[siteId]/fields?sectionType=WORK_PROGRAMME` — resolved effective list
- `POST /api/sites/[siteId]/fields` — create custom field
- `PATCH /api/sites/[siteId]/fields/[fieldId]` — relabel, toggle required/active
- `DELETE /api/sites/[siteId]/fields/[fieldId]` — custom only; system fields → 400
- `PATCH /api/sites/[siteId]/fields/reorder` — body `{ sectionType, orderedKeys: string[] }`,
  applied in a single transaction

### Reports
- `GET /api/reports?siteId&from&to&status`
- `POST /api/reports` — `{ siteId, reportDate }`, idempotent upsert on `(siteId, reportDate)`,
  seeds header from `Site`
- `GET|PATCH /api/reports/[reportId]` — header edit
- `GET /api/reports/[reportId]/sections/[type]` — rows + resolved field definitions
- `PUT /api/reports/[reportId]/sections/[type]/draft` — **full replace** of the section's rows
  (simplest correct autosave: delete-missing / upsert-present inside one transaction), sets
  `lastSavedAt`
- `POST /api/reports/[reportId]/sections/[type]/submit` — validate required fields → `SUBMITTED`
- `POST /api/reports/[reportId]/sections/[type]/reopen` — admin only, back to `DRAFT`
- `POST /api/reports/[reportId]/approve` — admin sets `approvedById` / `approvedAt`

### Attachments
- `POST /api/uploads` — multipart, one file; returns `{ url, storageKey }`. Enforce
  `image/jpeg|png|webp|heic` and a 10 MB cap **server-side**.
- `POST /api/task-rows/[taskRowId]/attachments` — link an uploaded file
- `DELETE /api/attachments/[attachmentId]`

### Corrective actions
- `GET /api/corrective-actions?siteId&status&overdue=true&assignedToId`
- `POST /api/corrective-actions` — create, then send email (§7)
- `PATCH /api/corrective-actions/[id]` — status, priority, dueDate, closureNote
- `POST /api/corrective-actions/[id]/resend-email`

### Dashboard & export
- `GET /api/sites/[siteId]/dashboard?from&to` — aggregates for §6
- `GET /api/export/site/[siteId]?date=YYYY-MM-DD` — single-day workbook, mirrors source layout
- `GET /api/export/site/[siteId]?from&to` — one worksheet per date in range

Export responses set
`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` and
`Content-Disposition: attachment; filename="DPR_<siteCode>_<date>.xlsx"`.

---

## 6. Admin Dashboard

Per site, over a selectable date range (default: last 7 days).

**Tiles**
- Reports submitted vs. expected (calendar days in range)
- Average % complete across task rows
- Open corrective actions, and of those, how many are overdue
- Labour: planned vs. actual headcount, total man-hours, absenteeism %

**Tables**
- Recent reports: date, engineer, section statuses, task count, avg % complete, approval state
- Task rows flagged `DELAYED` or `ON_HOLD`, newest first
- Corrective actions with an **overdue** flag

**Status badges** (single shared component `components/StatusBadge.tsx`, so colours never drift):

| Value | Colour |
| --- | --- |
| `COMPLETED` / `CLOSED` / `SUBMITTED` | green |
| `IN_PROGRESS` | blue |
| `NOT_STARTED` / `DRAFT` | gray |
| `DELAYED` / overdue | red |
| `ON_HOLD` | amber |
| Productivity `HIGH` | green · `NORMAL` gray · `LOW` red |

**Overdue flag**: rendered when `status != CLOSED && dueDate < startOfToday()`. Compare in the
site's timezone (assume `Asia/Kolkata` for the MVP; store the constant in `lib/constants.ts`).

---

## 7. Email Flow (Corrective Actions)

### 7.1 Provider abstraction
`lib/email/index.ts` exports `sendEmail({ to, subject, html, text })`. It dispatches on
`EMAIL_PROVIDER`:
- `resend` → `lib/email/resend.ts` using `RESEND_API_KEY`
- `smtp` → `lib/email/smtp.ts` using nodemailer and `SMTP_*`
- `console` → `lib/email/console.ts`, logs to stdout (default in dev; **no provider keys needed
  to run the app locally**)

### 7.2 Trigger
Admin submits `POST /api/corrective-actions`:
1. Validate; confirm `assignedToId` is an engineer with access to `siteId`.
2. Create the `CorrectiveAction` with `status = OPEN`.
3. Render the template and call `sendEmail`.
4. Write an `EmailLog` row (`SENT` or `FAILED` with the error message).
5. **Return 201 even if the email failed.** The action itself is the record of truth; a mail
   outage must not lose it. Surface the failure in the response payload and in the admin UI, with
   a resend button.

### 7.3 Template
`lib/email/templates/corrective-action.tsx` (or a plain template literal). Contents: site name,
report date, task reference (`taskCode` + `plannedWorkDescription` when linked), title, HO
guidance, priority, due date, and a deep link to `/my/corrective-actions`. Always send a plain
text alternative alongside the HTML.

### 7.4 Closure
Engineer marks `IN_PROGRESS` or adds a closure note; admin sets `CLOSED`, which stamps
`closedAt` / `closedById`. Optional courtesy email to the creator on closure.

### 7.5 Photos
Out of scope for email attachments in the MVP — link to the report instead.

---

## 8. Excel Export Mapping

Reproduces `Baijnath+Nitish.xlsx` cell-for-cell. Verified against the source file; **use these
exact coordinates.**

### 8.1 Sheet setup
- Sheet name: the report date, `YYYY-MM-DD` (a range export creates one sheet per date).
- Column widths (A→K): `18.43, 19.57, 34.86, 17.57, 15.71, 12.57, 20.86, 24, 16.86, 27, 30.14`
- Row heights: row 1 = 21, row 9 = 30, row 18 = 45
- All body cells: `alignment: { vertical: 'middle', wrapText: true }`, thin borders on table cells.

### 8.2 Title block
| Cell | Content |
| --- | --- |
| `A1:K1` (merged) | `DAILY CONSTRUCTION SITE PROGRAMME & PROGRESS CONTROL REPORT` — bold, centred, ~14pt |
| `A2:K2` (merged) | `Head Office Control & Monitoring Sheet \| Site Engineer & Supervisor Daily Accountability Log` — italic, centred |
| Row 3 | blank spacer |

### 8.3 Header block (labels bold in A/C/E, values in B/D/F)
| Row | A | B | C | D | E | F |
| --- | --- | --- | --- | --- | --- | --- |
| 4 | `Project Name:` | `report.projectName` | `Date:` | `report.reportDate` | `Site Engineer:` | `report.siteEngineerName` |
| 5 | `Location/Zone:` | `report.locationZone` | `Day of Week:` | `report.dayOfWeek` | `Site Supervisor:` | `report.siteSupervisorName` |
| 6 | `Contractor/Client:` | `report.contractorClient` | `Weather Condition:` | `report.weatherCondition` | `Approved By (HO):` | `approvedBy?.name ?? ''` |

Row 7 is blank. `D4` must be written as a real `Date` with `numFmt: 'dd-mmm-yyyy'` — the source
stores the serial `46239`, so writing a string would break re-import.

### 8.4 Section 1 — Work Programme
- `A8:K8` merged: `1. WORK PROGRAMME & TASK EXECUTION LOG (ENGINEER & SUPERVISOR)` — bold, white
  on a dark fill.
- Row 9 headers, A→K, bold with a light-grey fill:

| Col | Header | Source |
| --- | --- | --- |
| A | Task ID | `taskCode` |
| B | Location / Structure | `locationStructure` |
| C | Planned Work Description | `plannedWorkDescription` |
| D | Primary Trade Lead | `primaryTradeLead` |
| E | Target Qty | `targetQty` (number) |
| F | Achieved Qty | `achievedQty` (number) |
| G | Unit | `unit` |
| H | % Complete | `percentComplete` — **write the fraction**, `numFmt: '0%'` |
| I | Status | `status` → title case (`IN_PROGRESS` → `In Progress`) |
| J | Variance / Reason for Delay | `varianceReason` |
| K | Corrective Action (HO Guidance) | `correctiveActionNote` |

- Rows 10+ : one per `TaskRow`, ordered by `sortOrder`.
- Any **active custom fields** for this site are appended as columns L, M, … with their `label` in
  the header row and `custom[key]` in the body.
- Hidden system fields are omitted and the remaining columns shift left; drive the whole column
  list from `getFieldDefinitions()` rather than hard-coding A→K, and let the mapping above be the
  default ordering.

### 8.5 Section 2 — Labour Deployment
Starts two rows after the last task row (source: tasks end at 15, blank 16, banner 17).

- `A{n}:K{n}` merged: `2. DAILY LABOUR DEPLOYMENT & PRODUCTIVITY CONTROL`
- Header row (height 45), A→K:

| Col | Header | Source |
| --- | --- | --- |
| A | Labour Category | `labourCategory` |
| B | Contractor / Gang Leader | `contractorGangLeader` |
| C | Planned Staff | `plannedStaff` |
| D | Actual Present | `actualPresent` |
| E | OT Hours | `otHours` |
| F | Total Man-Hours | `totalManHours` |
| G | Assigned Work Area | `assignedWorkArea` |
| H | Output Delivered Today | `outputDeliveredToday` |
| I | Target Std Rate | `targetStdRate` |
| J | Productivity Check | `productivityCheck` → title case |
| K | Supervisor Remarks | `supervisorRemarks` |

- **Totals row** immediately after the last labour row: `A` = `TOTAL LABOUR` (bold), then sums in
  `C`, `D`, `E`, `F` only — B and G→K stay empty, matching row 24 of the source. Write real
  `SUM()` formulas over the labour row range so the file stays live in Excel.

### 8.6 Implementation
`lib/excel/buildWorkbook.ts` → `buildReportWorkbook(reports: ReportWithRelations[]): ExcelJS.Workbook`.
Keep it pure (no DB access, no `Response`) so it is unit-testable; the route handler fetches, calls
it, and streams `workbook.xlsx.writeBuffer()`.

---

## 9. Environment Variables

`.env.example` must list every one of these.

```bash
# Database — Google Cloud SQL (PostgreSQL)
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/dpr?schema=public"
# Optional: direct (non-pooled) connection for migrations
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/dpr?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate with: openssl rand -base64 32"

# Email: resend | smtp | console
EMAIL_PROVIDER="console"
MAIL_FROM="DPR Control <dpr@example.com>"
RESEND_API_KEY=""
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_SECURE="false"

# File storage: local | gcs
STORAGE_DRIVER="local"
LOCAL_UPLOAD_DIR="./public/uploads"
GCS_BUCKET=""
GCS_PROJECT_ID=""
GOOGLE_APPLICATION_CREDENTIALS=""

# App
APP_TIMEZONE="Asia/Kolkata"
SEED_ADMIN_EMAIL="admin@brij.example.com"
SEED_ADMIN_PASSWORD="ChangeMe123!"
```

### Cloud SQL connection guide (goes in `README.md`)
Cover all three paths, because the right one depends on where the app runs:
1. **Local development** — Cloud SQL Auth Proxy:
   `./cloud-sql-proxy PROJECT:REGION:INSTANCE --port 5432`, then point `DATABASE_URL` at
   `127.0.0.1:5432`.
2. **Cloud Run / App Engine** — Unix socket:
   `DATABASE_URL="postgresql://USER:PASS@localhost/dpr?host=/cloudsql/PROJECT:REGION:INSTANCE"`.
3. **Direct public IP** — authorise the client IP in Cloud SQL and append `?sslmode=require`.

Also document: creating the instance and database, creating a least-privilege DB user, and that
`prisma migrate deploy` (not `migrate dev`) is what runs in production.

---

## 10. Seed Plan

`prisma/seed.ts`, idempotent (`upsert` everywhere) so it can be re-run safely.

1. **Users**
   - `ADMIN` — from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
   - `ENGINEER` — Baijnath (`baijnath@example.com`)
   - `ENGINEER` — Nitish (`nitish@example.com`), the site supervisor
2. **Site** — code `BIJ`, name "Bijapur Site", projectName "BRIJ Project", locationZone "Bijapur",
   contractorClient "GRIL". Memberships for both engineers.
3. **Global `FieldDefinition` template** — all 11 `WORK_PROGRAMME` system fields and all 11
   `LABOUR_DEPLOYMENT` system fields with `siteId = null`, `isSystem = true`, `order` matching the
   Excel column order (0-indexed). This must exist or the forms render empty.
4. **Report** for the sample date (`2026-08-05`, Wednesday), weather "Clear / Normal Work", both
   sections `SUBMITTED`.
5. **Six `TaskRow`s** — TSK-01…TSK-06 exactly as in the source workbook (including the deliberate
   `TSK-04` overachievement at `percentComplete = 1.0625`, which is the regression case for the
   "don't clamp" rule).
6. **Five `LabourRow`s** — Carpenter, Mason, Welder, Bar Bender, Helper, with the sample figures
   (33 planned / 31 present / 62 OT / 310 man-hours in aggregate).
7. **Two `CorrectiveAction`s** — one `OPEN` and overdue (from TSK-03, "Arrange backup generator"),
   one `CLOSED` — so the dashboard's badge and overdue states both have data on first run.

Wire it up with `"prisma": { "seed": "tsx prisma/seed.ts" }` in `package.json`.

---

## 11. Phased Implementation Checklist

### Phase 0 — Foundation
- [ ] `create-next-app` (TypeScript, Tailwind, App Router, `src/` dir, no `--eslint` conflicts)
- [ ] Install: `prisma@^6 @prisma/client@^6 next-auth@^4 bcryptjs zod exceljs resend nodemailer date-fns clsx tsx`
- [ ] `lib/prisma.ts` singleton (guard against hot-reload connection storms)
- [ ] `.env.example`, `.gitignore` (`.env`, `/public/uploads`)

### Phase 1 — Data layer
- [ ] Finalise `prisma/schema.prisma`, run `prisma migrate dev --name init`
- [ ] `prisma/seed.ts` per §10, verify with `prisma studio`

### Phase 2 — Auth
- [ ] NextAuth credentials route, `authOptions` in `lib/auth.ts`
- [ ] `types/next-auth.d.ts` role augmentation
- [ ] `middleware.ts`, `lib/auth-guards.ts`
- [ ] `/login` page, role-based redirect from `/`

### Phase 3 — Field engine
- [ ] `lib/fields.ts` — `getFieldDefinitions(siteId, sectionType)` merge/override logic
- [ ] `lib/validation/rowSchema.ts` — build a Zod schema from field definitions at runtime
- [ ] `components/DynamicField.tsx` — renders one field by `fieldType`
- [ ] `components/DynamicRowForm.tsx` — a row of fields, add/remove/reorder rows

### Phase 4 — Engineer flow
- [ ] `/sites`, `/sites/[siteId]`, report header page
- [ ] Work Programme and Labour section pages
- [ ] Draft autosave (debounce ~2s + explicit "Save draft") against the `draft` endpoint
- [ ] Submit with required-field validation and a confirmation step
- [ ] Photo upload on task rows, thumbnail strip, delete

### Phase 5 — Admin
- [ ] Site CRUD, user CRUD, membership assignment
- [ ] Field configuration UI with drag-to-reorder (persist via the `reorder` endpoint)
- [ ] Per-site dashboard with tiles, tables, badges, overdue flags
- [ ] Read-only report view, approve, reopen section

### Phase 6 — Corrective actions & email
- [ ] Email provider abstraction + `console` driver
- [ ] Create action → send → `EmailLog`; resend endpoint
- [ ] Admin list with filters; engineer `/my/corrective-actions`
- [ ] Open → in-progress → closed transitions with audit entries

### Phase 7 — Excel export
- [ ] `lib/excel/buildWorkbook.ts` per §8
- [ ] Single-date and date-range export routes, download buttons in the admin UI
- [ ] Compare output against `Baijnath+Nitish.xlsx` — cell positions, merges, `0%` format, totals

### Phase 8 — PWA & polish
- [ ] `manifest.json`, icons, `theme-color`, service worker for the app shell
- [ ] Mobile ergonomics: ≥44px touch targets, `inputMode="decimal"` on numeric fields, sticky
      save bar
- [ ] Loading / empty / error states, `error.tsx` + `not-found.tsx`
- [ ] `README.md` with the Cloud SQL guide (§9) and local setup

### Phase 9 — Hardening
- [ ] Server-side authorization test pass: engineer cannot touch another site's data by id
- [ ] Upload MIME/size enforcement on the server
- [ ] Rate-limit login attempts
- [ ] Unit tests for `getFieldDefinitions`, percent-complete maths, and workbook building

---

## 12. Conventions for the implementing agent

- **Directory layout**: `src/app` (routes), `src/components`, `src/lib`, `src/types`.
- **Server-side data fetching by default.** Reach for a Client Component only where interaction
  demands it (forms, drag-reorder, autosave).
- **All money/quantity maths uses `Decimal`**, never JS floats. Convert at the edge with
  `.toNumber()` only for display and Excel.
- **Dates**: store `reportDate` as a date-only column; format for display with `date-fns` in
  `APP_TIMEZONE`. Never `new Date(string)` on a bare `YYYY-MM-DD` without pinning the timezone.
- **No secrets in client components.** `RESEND_API_KEY`, `DATABASE_URL`, etc. are server-only;
  nothing sensitive gets a `NEXT_PUBLIC_` prefix.
- **Zod at every API boundary**, including the dynamic custom-field payload.
- When a spec detail here conflicts with what the source workbook actually contains, **the
  workbook wins** — and note the discrepancy in the PR description.
