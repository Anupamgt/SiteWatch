import { prisma } from "@/lib/prisma";
import {
  formatDateOnly,
  parseDateOnly,
  yesterdayInAppTimezone,
} from "@/lib/dates";

export type NamedPerson = { id: string; name: string; email: string };

export type MachineSummaryRow = {
  id: string;
  name: string;
  category: string | null;
  ownership: "OWNED" | "RENTED";
  status: string;
  ownerLabel: string | null;
  registration: string | null;
  dailyRate: number | null;
  notes: string | null;
  siteId: string;
  siteCode: string;
  siteName: string;
};

export type DashboardInsights = {
  engineers: { total: number; names: NamedPerson[] };
  supervisors: { total: number; names: NamedPerson[] };
  labourPresentYesterday: {
    date: string;
    total: number;
    byCategory: Array<{ category: string; present: number }>;
  };
  machines: {
    owned: number;
    rented: number;
    active: number;
    items: MachineSummaryRow[];
  };
};

async function peopleOnSites(siteIds: string[] | "all") {
  const membershipWhere =
    siteIds === "all"
      ? { user: { isActive: true } }
      : { siteId: { in: siteIds }, user: { isActive: true } };

  // Distinct users via membership — select only what the panel needs.
  const memberships = await prisma.siteMembership.findMany({
    where: membershipWhere,
    distinct: ["userId"],
    select: {
      userId: true,
      user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
    },
  });

  const engineers = new Map<string, NamedPerson>();
  const supervisors = new Map<string, NamedPerson>();
  for (const m of memberships) {
    if (!m.user.isActive) continue;
    const person = { id: m.user.id, name: m.user.name, email: m.user.email };
    if (m.user.role === "ENGINEER") engineers.set(person.id, person);
    if (m.user.role === "SUPERVISOR") supervisors.set(person.id, person);
  }
  return {
    engineers: {
      total: engineers.size,
      names: [...engineers.values()].sort((a, b) => a.name.localeCompare(b.name)),
    },
    supervisors: {
      total: supervisors.size,
      names: [...supervisors.values()].sort((a, b) => a.name.localeCompare(b.name)),
    },
  };
}

async function labourPresentOnDate(siteIds: string[] | "all", dateStr: string) {
  const reportDate = parseDateOnly(dateStr);
  const rows = await prisma.labourRow.findMany({
    where: {
      section: {
        type: "LABOUR_DEPLOYMENT",
        report: {
          reportDate,
          ...(siteIds === "all" ? {} : { siteId: { in: siteIds } }),
        },
      },
    },
    select: { labourCategory: true, actualPresent: true },
  });

  let total = 0;
  const byCat = new Map<string, number>();
  for (const row of rows) {
    const present = row.actualPresent ?? 0;
    total += present;
    const cat = row.labourCategory?.trim() || "Unspecified";
    byCat.set(cat, (byCat.get(cat) ?? 0) + present);
  }

  return {
    date: dateStr,
    total,
    byCategory: [...byCat.entries()]
      .map(([category, present]) => ({ category, present }))
      .sort((a, b) => b.present - a.present || a.category.localeCompare(b.category)),
  };
}

async function machinesForSites(siteIds: string[] | "all"): Promise<DashboardInsights["machines"]> {
  const machines = await prisma.machine.findMany({
    where: {
      isActive: true,
      ...(siteIds === "all" ? {} : { siteId: { in: siteIds } }),
    },
    select: {
      id: true,
      name: true,
      category: true,
      ownership: true,
      status: true,
      ownerLabel: true,
      registration: true,
      dailyRate: true,
      notes: true,
      siteId: true,
      site: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ ownership: "asc" }, { name: "asc" }],
    take: 50,
  });

  const items: MachineSummaryRow[] = machines.map((m) => ({
    id: m.id,
    name: m.name,
    category: m.category,
    ownership: m.ownership,
    status: m.status,
    ownerLabel: m.ownerLabel,
    registration: m.registration,
    dailyRate: m.dailyRate == null ? null : Number(m.dailyRate),
    notes: m.notes,
    siteId: m.siteId,
    siteCode: m.site.code,
    siteName: m.site.name,
  }));

  return {
    owned: items.filter((i) => i.ownership === "OWNED").length,
    rented: items.filter((i) => i.ownership === "RENTED").length,
    active: items.filter((i) => i.status === "ACTIVE").length,
    items,
  };
}

/** Portfolio-wide or site-scoped insight panel data. */
export async function getDashboardInsights(siteIds: string[] | "all"): Promise<DashboardInsights> {
  if (Array.isArray(siteIds) && siteIds.length === 0) {
    const yesterday = yesterdayInAppTimezone();
    return {
      engineers: { total: 0, names: [] },
      supervisors: { total: 0, names: [] },
      labourPresentYesterday: { date: yesterday, total: 0, byCategory: [] },
      machines: { owned: 0, rented: 0, active: 0, items: [] },
    };
  }

  const yesterday = yesterdayInAppTimezone();
  const [people, labourPresentYesterday, machines] = await Promise.all([
    peopleOnSites(siteIds),
    labourPresentOnDate(siteIds, yesterday),
    machinesForSites(siteIds),
  ]);

  return {
    engineers: people.engineers,
    supervisors: people.supervisors,
    labourPresentYesterday,
    machines,
  };
}

export function formatInsightDate(dateStr: string): string {
  return formatDateOnly(parseDateOnly(dateStr));
}
