/**
 * Dev load test — 25 concurrent users against local Next.js.
 *
 * Strategy: log in once (avoid CSRF/rate-limit stampede), then run 25
 * concurrent authenticated journeys sharing that session — typical after
 * users are already signed in.
 *
 * Usage: npx tsx scripts/load-test-25.ts [baseUrl]
 */
import { PrismaClient } from "@prisma/client";

const BASE = (process.argv[2] || "http://127.0.0.1:3000").replace(/\/$/, "");
const CONCURRENCY = 25;
const ROUNDS = 3;

type Jar = Map<string, string>;

function parseSetCookie(headers: Headers, jar: Jar) {
  const raw = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  const fallback = headers.get("set-cookie");
  const list = raw.length ? raw : fallback ? [fallback] : [];
  for (const line of list) {
    const part = line.split(";")[0];
    const eq = part.indexOf("=");
    if (eq > 0) jar.set(part.slice(0, eq), part.slice(eq + 1));
  }
}

function cookieHeader(jar: Jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function cloneJar(jar: Jar): Jar {
  return new Map(jar);
}

async function fetchJar(
  jar: Jar,
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; ms: number; json?: unknown }> {
  const headers = new Headers(init.headers);
  if (jar.size) headers.set("cookie", cookieHeader(jar));
  const t0 = Date.now();
  const res = await fetch(`${BASE}${path}`, { ...init, headers, redirect: "manual" });
  parseSetCookie(res.headers, jar);
  const ms = Date.now() - t0;
  const ct = res.headers.get("content-type") || "";
  let json: unknown;
  if (ct.includes("application/json")) {
    json = await res.json().catch(() => null);
  } else {
    await res.arrayBuffer().catch(() => null);
  }
  return { status: res.status, ms, json };
}

async function login(email: string, password: string): Promise<Jar> {
  const jar: Jar = new Map();
  const csrf = await fetchJar(jar, "/api/auth/csrf");
  const token = (csrf.json as { csrfToken?: string } | undefined)?.csrfToken;
  if (!token) throw new Error("No CSRF token");

  const res = await fetchJar(jar, "/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      csrfToken: token,
      email,
      password,
      json: "true",
      callbackUrl: `${BASE}/`,
    }),
  });

  const session = await fetchJar(jar, "/api/auth/session");
  const user = (session.json as { user?: unknown } | undefined)?.user;
  if (!user) {
    throw new Error(`Login failed (${res.status}) — no session user`);
  }
  return jar;
}

type Sample = { name: string; status: number; ms: number; ok: boolean };

async function userJourney(
  baseJar: Jar,
  siteId: string,
  reportId: string,
  vu: number,
): Promise<Sample[]> {
  const jar = cloneJar(baseJar);
  const samples: Sample[] = [];
  const mark = (name: string, status: number, ms: number, ok: boolean) => {
    samples.push({ name, status, ms, ok });
  };

  {
    const r = await fetchJar(new Map(), "/login");
    mark("GET /login", r.status, r.ms, r.status === 200);
  }
  {
    const r = await fetchJar(new Map(), "/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: vu % 2 === 0 ? "en" : "hi" }),
    });
    mark("POST /api/locale", r.status, r.ms, r.status === 200);
  }
  {
    const r = await fetchJar(jar, "/api/auth/session");
    mark(
      "GET /api/auth/session",
      r.status,
      r.ms,
      r.status === 200 && Boolean((r.json as { user?: unknown })?.user),
    );
  }
  {
    const r = await fetchJar(jar, "/sites");
    mark("GET /sites", r.status, r.ms, r.status === 200);
  }
  {
    const r = await fetchJar(jar, `/sites/${siteId}`);
    mark("GET /sites/:id", r.status, r.ms, r.status === 200);
  }
  {
    const r = await fetchJar(jar, "/tickets");
    mark("GET /tickets", r.status, r.ms, r.status === 200);
  }
  {
    const r = await fetchJar(jar, `/api/sites/${siteId}/tickets`);
    mark("GET /api/site tickets", r.status, r.ms, r.status === 200);
  }
  {
    const r = await fetchJar(jar, `/api/machines?siteId=${siteId}`);
    mark("GET /api/machines", r.status, r.ms, r.status === 200);
  }

  // Only ~1/5 of VUs write drafts, each to their own report, to avoid lock stampede
  if (vu % 5 === 0) {
    const r = await fetchJar(jar, `/api/reports/${reportId}/sections/WORK_PROGRAMME/draft`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: [
          {
            taskCode: `LT-VU${vu}`,
            plannedWorkDescription: `Load test VU ${vu}`,
            status: "IN_PROGRESS",
            sortOrder: 0,
          },
        ],
      }),
    });
    mark(
      "PUT draft WORK_PROGRAMME",
      r.status,
      r.ms,
      r.status === 200 || r.status === 409,
    );
  }

  return samples;
}

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function main() {
  console.log(`Load test → ${BASE}`);
  console.log(`Concurrency: ${CONCURRENCY} · rounds: ${ROUNDS}`);

  // Health
  const health = await fetch(`${BASE}/login`);
  if (!health.ok) throw new Error(`Dev server not healthy: ${health.status}`);

  const prisma = new PrismaClient();
  const site = await prisma.site.findFirst({
    where: { isActive: true },
    select: { id: true, code: true },
  });
  if (!site) throw new Error("No active site");

  const engineer = await prisma.user.findUnique({
    where: { email: "engineer@example.com" },
  });
  if (!engineer) throw new Error("engineer@example.com missing — run seed");
  await prisma.siteMembership.upsert({
    where: { userId_siteId: { userId: engineer.id, siteId: site.id } },
    update: {},
    create: { userId: engineer.id, siteId: site.id },
  });

  const reportDate = new Date();
  reportDate.setUTCHours(0, 0, 0, 0);
  // One shared read report + dedicated draft reports for writers (vu % 5 === 0)
  const baseDate = new Date(reportDate);
  baseDate.setUTCDate(baseDate.getUTCDate() - 3);

  const reportIds: string[] = [];
  for (let vu = 0; vu < CONCURRENCY; vu++) {
    if (vu % 5 !== 0 && vu !== 0) {
      reportIds.push(reportIds[0] || "");
      continue;
    }
    const d = new Date(baseDate);
    d.setUTCDate(d.getUTCDate() - Math.floor(vu / 5));
    const report = await prisma.report.upsert({
      where: { siteId_reportDate: { siteId: site.id, reportDate: d } },
      update: {},
      create: {
        siteId: site.id,
        reportDate: d,
        projectName: `Load Test VU${vu}`,
        dayOfWeek: "LoadTest",
        createdById: engineer.id,
      },
      select: { id: true },
    });
    await prisma.reportSection.upsert({
      where: { reportId_type: { reportId: report.id, type: "WORK_PROGRAMME" } },
      update: { status: "DRAFT", submittedAt: null, submittedById: null },
      create: { reportId: report.id, type: "WORK_PROGRAMME", status: "DRAFT" },
    });
    reportIds[vu] = report.id;
    if (vu === 0) {
      // fill non-writer slots with shared report id later
      for (let i = 0; i < CONCURRENCY; i++) {
        if (i % 5 !== 0) reportIds[i] = report.id;
      }
    }
  }
  await prisma.$disconnect();

  const email = process.env.SEED_ENGINEER_EMAIL || "engineer@example.com";
  const password = process.env.SEED_ENGINEER_PASSWORD || "engineer123";

  console.log("Logging in once (shared session for concurrent VUs)…");
  const sessionJar = await login(email, password);
  console.log("Session OK");

  const all: Sample[] = [];
  let vuFailures = 0;

  for (let round = 1; round <= ROUNDS; round++) {
    console.log(`\n— Round ${round}/${ROUNDS}`);
    const started = Date.now();
    const results = await Promise.all(
      Array.from({ length: CONCURRENCY }, (_, vu) =>
        userJourney(sessionJar, site.id, reportIds[vu], vu).catch((err) => {
          vuFailures += 1;
          console.error("VU failed:", err instanceof Error ? err.message : err);
          return [] as Sample[];
        }),
      ),
    );
    const flat = results.flat();
    all.push(...flat);
    console.log(
      `  requests=${flat.length} failed=${flat.filter((s) => !s.ok).length} wall=${Date.now() - started}ms`,
    );
  }

  const byName = new Map<string, Sample[]>();
  for (const s of all) {
    const list = byName.get(s.name) ?? [];
    list.push(s);
    byName.set(s.name, list);
  }

  console.log("\n=== Results (25 concurrent × 3 rounds) ===");
  console.log(
    `${"endpoint".padEnd(28)} ${"n".padStart(4)} ${"ok%".padStart(6)} ${"p50".padStart(7)} ${"p95".padStart(7)} ${"max".padStart(7)}`,
  );

  let totalOk = 0;
  let totalN = 0;
  for (const [name, list] of [...byName.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const ok = list.filter((s) => s.ok).length;
    const ms = list.map((s) => s.ms).sort((a, b) => a - b);
    totalOk += ok;
    totalN += list.length;
    console.log(
      `${name.padEnd(28)} ${String(list.length).padStart(4)} ${((ok / list.length) * 100).toFixed(1).padStart(6)} ${String(percentile(ms, 50)).padStart(7)} ${String(percentile(ms, 95)).padStart(7)} ${String(ms.at(-1) ?? 0).padStart(7)}`,
    );
  }

  const okRate = totalN ? totalOk / totalN : 0;
  console.log(
    `\nOverall: ${totalOk}/${totalN} ok (${(okRate * 100).toFixed(1)}%), VU hard failures=${vuFailures}`,
  );
  console.log(`Site ${site.code}`);

  const drafts = byName.get("PUT draft WORK_PROGRAMME") ?? [];
  const draftOk = drafts.length
    ? drafts.filter((s) => s.ok).length / drafts.length
    : 1;
  const draftP95 = percentile(
    drafts.map((s) => s.ms).sort((a, b) => a - b),
    95,
  );

  // With pool=15 and fewer writers: ≥95% overall, drafts ≥90%, draft p95 < 8s
  const pass = okRate >= 0.95 && draftOk >= 0.9 && draftP95 < 8000 && vuFailures <= 1;
  if (!pass) {
    console.error("\nLOAD TEST FAILED", { okRate, draftOk, draftP95, vuFailures });
    process.exit(1);
  }
  console.log("\nLOAD TEST PASSED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
