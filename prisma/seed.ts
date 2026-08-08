/**
 * Idempotent seed per ARCHITECTURE.md §10. Safe to re-run: every write is an
 * `upsert`. Nothing downstream renders until the global FieldDefinition
 * template exists, so this must run before the app is used for the first
 * time.
 */
import { PrismaClient, SectionType, FieldType, TaskStatus, ProductivityCheck } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;

async function hash(password: string) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function seedUsers() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "admin123";
  const engineerEmail = process.env.SEED_ENGINEER_EMAIL || "engineer@example.com";
  const engineerPassword = process.env.SEED_ENGINEER_PASSWORD || "engineer123";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Admin",
      passwordHash: await hash(adminPassword),
      role: "ADMIN",
    },
  });

  // Site engineer — Baijnath. This is the account that satisfies the
  // engineer@example.com / engineer123 login requested for local dev/demo.
  const engineer = await prisma.user.upsert({
    where: { email: engineerEmail },
    update: {},
    create: {
      email: engineerEmail,
      name: "Baijnath",
      passwordHash: await hash(engineerPassword),
      role: "ENGINEER",
    },
  });

  // Site supervisor — Nitish. Also an ENGINEER-role login per ARCHITECTURE §10.
  const supervisorEmail = "nitish@example.com";
  const supervisorPassword = process.env.SEED_SUPERVISOR_PASSWORD || "nitish123";
  const supervisor = await prisma.user.upsert({
    where: { email: supervisorEmail },
    update: {},
    create: {
      email: supervisorEmail,
      name: "Nitish",
      passwordHash: await hash(supervisorPassword),
      role: "ENGINEER",
    },
  });

  console.log(`  users: admin=${admin.email} engineer=${engineer.email} supervisor=${supervisor.email}`);
  return { admin, engineer, supervisor };
}

async function seedSite() {
  const site = await prisma.site.upsert({
    where: { code: "BIJ" },
    update: {},
    create: {
      code: "BIJ",
      name: "Bijapur Site",
      projectName: "BRIJ Project",
      locationZone: "Bijapur",
      contractorClient: "GRIL",
      standardShiftHours: 8,
    },
  });
  console.log(`  site: ${site.code} — ${site.name}`);
  return site;
}

async function seedMemberships(siteId: string, userIds: string[]) {
  for (const userId of userIds) {
    await prisma.siteMembership.upsert({
      where: { userId_siteId: { userId, siteId } },
      update: {},
      create: { userId, siteId },
    });
  }
}

type FieldSeed = {
  key: string;
  label: string;
  fieldType: FieldType;
  order: number;
  isRequired?: boolean;
  isActive?: boolean;
  isSystem?: boolean;
  options?: string[];
  placeholder?: string;
  helpText?: string;
};

// Column order matches ARCHITECTURE.md §8.4 (A -> K).
const WORK_PROGRAMME_FIELDS: FieldSeed[] = [
  { key: "taskCode", label: "Task ID", fieldType: "TEXT", order: 0, isRequired: true, placeholder: "TSK-01" },
  { key: "locationStructure", label: "Location / Structure", fieldType: "TEXT", order: 1 },
  { key: "plannedWorkDescription", label: "Planned Work Description", fieldType: "TEXTAREA", order: 2, isRequired: true },
  { key: "primaryTradeLead", label: "Primary Trade Lead", fieldType: "TEXT", order: 3 },
  { key: "targetQty", label: "Target Qty", fieldType: "DECIMAL", order: 4, isRequired: true },
  { key: "achievedQty", label: "Achieved Qty", fieldType: "DECIMAL", order: 5, isRequired: true },
  { key: "unit", label: "Unit", fieldType: "TEXT", order: 6, isRequired: true, placeholder: "CuM, SqM, Nos..." },
  { key: "percentComplete", label: "% Complete", fieldType: "PERCENT", order: 7, helpText: "Auto-computed from Target/Achieved; edit to override." },
  {
    key: "status",
    label: "Status",
    fieldType: "SELECT",
    order: 8,
    isRequired: true,
    options: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "DELAYED", "ON_HOLD"] satisfies TaskStatus[],
  },
  { key: "varianceReason", label: "Variance / Reason for Delay", fieldType: "TEXTAREA", order: 9 },
  { key: "correctiveActionNote", label: "Corrective Action (HO Guidance)", fieldType: "TEXTAREA", order: 10 },
];

// Simplified engineer labour form: Labour Type + Bus Number (headcount on site).
// "Bus Number" is site jargon for how many labour of that type are present.
// Stored in actualPresent so dashboards/exports keep working. Other system
// columns remain in the template but inactive (admin can re-enable).
const LABOUR_FIELDS: FieldSeed[] = [
  {
    key: "labourCategory",
    label: "Labour Type",
    fieldType: "SELECT",
    order: 0,
    isRequired: true,
    options: [
      "Carpenter",
      "Mason",
      "Bar Bender",
      "Welder",
      "Gang Leader",
      "Operator",
      "Helper",
    ],
    helpText: "Trade for this labour group (pre-filled from the site list).",
  },
  {
    key: "actualPresent",
    label: "Bus Number",
    fieldType: "NUMBER",
    order: 1,
    isRequired: true,
    placeholder: "e.g. 12",
    helpText: "Number of labour of this type present on site today.",
  },
  // Hidden from the simplified engineer form (kept for Excel / admin re-enable).
  { key: "contractorGangLeader", label: "Contractor / Gang Leader", fieldType: "TEXT", order: 2, isActive: false },
  { key: "plannedStaff", label: "Planned Staff", fieldType: "NUMBER", order: 3, isActive: false },
  { key: "otHours", label: "OT Hours", fieldType: "DECIMAL", order: 4, isActive: false },
  {
    key: "totalManHours",
    label: "Total Man-Hours",
    fieldType: "DECIMAL",
    order: 5,
    isActive: false,
    helpText: "Suggested from Bus Number × shift hours; edit to override.",
  },
  { key: "assignedWorkArea", label: "Assigned Work Area", fieldType: "TEXT", order: 6, isActive: false },
  { key: "outputDeliveredToday", label: "Output Delivered Today", fieldType: "TEXT", order: 7, isActive: false },
  {
    key: "targetStdRate",
    label: "Target Std Rate",
    fieldType: "TEXT",
    order: 8,
    isActive: false,
    placeholder: "20 SqM / Man-Day, N/A...",
  },
  {
    key: "productivityCheck",
    label: "Productivity Check",
    fieldType: "SELECT",
    order: 9,
    isActive: false,
    options: ["LOW", "NORMAL", "HIGH", "NOT_APPLICABLE"] satisfies ProductivityCheck[],
  },
  { key: "supervisorRemarks", label: "Supervisor Remarks", fieldType: "TEXTAREA", order: 10, isActive: false },
  // Previous mistaken vehicle-ID custom field — keep inactive if present.
  {
    key: "busNumber",
    label: "Bus Number (legacy)",
    fieldType: "TEXT",
    order: 99,
    isActive: false,
    isSystem: false,
    helpText: "Deprecated; use Bus Number (actualPresent) for labour headcount.",
  },
];

/**
 * Global field-definition rows have `siteId = null`. The compound unique key
 * `siteId_sectionType_key` cannot be used in a Prisma `where` with `null`
 * (a type error, and semantically wrong anyway — Postgres treats NULLs as
 * distinct, so `@@unique` does not dedupe global rows). We rely instead on
 * the partial unique index added in the init migration
 * (`FieldDefinition_global_sectionType_key`, `WHERE "siteId" IS NULL`) and a
 * plain `findFirst` + `create`/`update` here. Idempotent: re-running this
 * finds the existing row by (siteId: null, sectionType, key) and updates it
 * rather than creating a duplicate.
 */
async function seedFieldTemplate(sectionType: SectionType, fields: FieldSeed[]) {
  for (const f of fields) {
    const existing = await prisma.fieldDefinition.findFirst({
      where: { siteId: null, sectionType, key: f.key },
    });

    const sharedData = {
      label: f.label,
      fieldType: f.fieldType,
      order: f.order,
      isRequired: f.isRequired ?? false,
      isActive: f.isActive ?? true,
      isSystem: f.isSystem ?? true,
      options: f.options ?? [],
      placeholder: f.placeholder ?? null,
      helpText: f.helpText ?? null,
    };

    if (existing) {
      await prisma.fieldDefinition.update({ where: { id: existing.id }, data: sharedData });
    } else {
      await prisma.fieldDefinition.create({
        data: { siteId: null, sectionType, key: f.key, ...sharedData },
      });
    }
  }
  console.log(`  field template: ${sectionType} (${fields.length} fields)`);
}

async function seedSampleReport(
  siteId: string,
  engineerId: string,
  supervisorId: string,
  engineerName: string,
  supervisorName: string
) {
  const reportDate = new Date(Date.UTC(2026, 7, 5)); // 2026-08-05, Wednesday

  const report = await prisma.report.upsert({
    where: { siteId_reportDate: { siteId, reportDate } },
    update: {},
    create: {
      siteId,
      reportDate,
      projectName: "BRIJ Project",
      locationZone: "Bijapur",
      contractorClient: "GRIL",
      siteEngineerName: engineerName,
      siteSupervisorName: supervisorName,
      weatherCondition: "Clear / Normal Work",
      dayOfWeek: "Wednesday",
      createdById: engineerId,
    },
  });

  const workSection = await prisma.reportSection.upsert({
    where: { reportId_type: { reportId: report.id, type: "WORK_PROGRAMME" } },
    update: {},
    create: {
      reportId: report.id,
      type: "WORK_PROGRAMME",
      status: "SUBMITTED",
      submittedById: engineerId,
      submittedAt: reportDate,
      lastSavedAt: reportDate,
    },
  });

  const labourSection = await prisma.reportSection.upsert({
    where: { reportId_type: { reportId: report.id, type: "LABOUR_DEPLOYMENT" } },
    update: {},
    create: {
      reportId: report.id,
      type: "LABOUR_DEPLOYMENT",
      status: "SUBMITTED",
      submittedById: supervisorId,
      submittedAt: reportDate,
      lastSavedAt: reportDate,
    },
  });

  // Exact match of Baijnath+Nitish.xlsx rows 10-15 (ARCHITECTURE.md §8.4 / §10.5,
  // REMAINING_WORK.md Step 13 "Also fix in this step"). This lets the export be
  // diffed cell-for-cell against the source workbook. TSK-04 is the deliberate
  // overachievement (85/80 = 1.0625) that regression-tests the "don't clamp" rule.
  const taskRows: Array<{
    taskCode: string;
    locationStructure: string;
    plannedWorkDescription: string;
    primaryTradeLead: string;
    targetQty: number;
    achievedQty: number;
    unit: string;
    percentComplete: number;
    status: TaskStatus;
    varianceReason?: string;
    correctiveActionNote?: string;
  }> = [
    {
      taskCode: "TSK-01",
      locationStructure: "Zone A - Footing F3-F7",
      plannedWorkDescription: "Reinforcement Binding & Barbering",
      primaryTradeLead: "Bar Bender",
      targetQty: 1500,
      achievedQty: 1400,
      unit: "Kg",
      percentComplete: 1400 / 1500, // 93.3%
      status: "IN_PROGRESS",
      varianceReason: "Minor steel re-cutting delay",
      correctiveActionNote: "Increase rebar cutters on site",
    },
    {
      taskCode: "TSK-02",
      locationStructure: "Zone A - Footing F3-F7",
      plannedWorkDescription: "Shuttering & Formwork Assembly",
      primaryTradeLead: "Carpenter",
      targetQty: 120,
      achievedQty: 120,
      unit: "SqM",
      percentComplete: 1.0,
      status: "COMPLETED",
      varianceReason: "Completed on schedule",
      correctiveActionNote: "Proceed to inspection",
    },
    {
      taskCode: "TSK-03",
      locationStructure: "Zone B - Retaining Wall",
      plannedWorkDescription: "Structural Steel Welding & Gusset Prep",
      primaryTradeLead: "Welder",
      targetQty: 45,
      achievedQty: 30,
      unit: "Joints",
      percentComplete: 30 / 45, // 66.7%
      status: "DELAYED",
      varianceReason: "Power failure for 2 hours",
      correctiveActionNote: "Arrange backup generator tomorrow",
    },
    {
      taskCode: "TSK-04",
      locationStructure: "Zone B - Ground Slab",
      plannedWorkDescription: "PCC Bed Brickwork & Masonry Edge",
      primaryTradeLead: "Mason",
      targetQty: 80,
      achievedQty: 85,
      unit: "CuM",
      percentComplete: 1.0625, // deliberate overachievement — do not clamp
      status: "COMPLETED",
      varianceReason: "Target exceeded slightly",
      correctiveActionNote: "Maintain mortar quality",
    },
    {
      taskCode: "TSK-05",
      locationStructure: "Site Wide",
      plannedWorkDescription: "Material Handling & Site Clearing",
      primaryTradeLead: "Helper",
      targetQty: 1,
      achievedQty: 1,
      unit: "LS",
      percentComplete: 1.0,
      status: "COMPLETED",
      varianceReason: "Clean site prior to concrete pour",
      correctiveActionNote: "Good practice maintained",
    },
    {
      taskCode: "TSK-06",
      locationStructure: "Zone A - Column C1-C6",
      plannedWorkDescription: "Column Rebar Rigging & Plumb Alignment",
      primaryTradeLead: "Bar Bender",
      targetQty: 6,
      achievedQty: 4,
      unit: "Nos",
      percentComplete: 4 / 6, // 66.7%
      status: "IN_PROGRESS",
      varianceReason: "Crane availability issue",
      correctiveActionNote: "Reschedule crane slot for 08:00 AM",
    },
  ];

  for (let i = 0; i < taskRows.length; i++) {
    const t = taskRows[i];
    const existing = await prisma.taskRow.findFirst({
      where: { sectionId: workSection.id, taskCode: t.taskCode },
    });
    const data = {
      sectionId: workSection.id,
      sortOrder: i,
      taskCode: t.taskCode,
      locationStructure: t.locationStructure,
      plannedWorkDescription: t.plannedWorkDescription,
      primaryTradeLead: t.primaryTradeLead,
      targetQty: t.targetQty,
      achievedQty: t.achievedQty,
      unit: t.unit,
      percentComplete: t.percentComplete,
      status: t.status,
      varianceReason: t.varianceReason ?? null,
      correctiveActionNote: t.correctiveActionNote ?? null,
    };
    if (existing) {
      await prisma.taskRow.update({ where: { id: existing.id }, data });
    } else {
      await prisma.taskRow.create({ data });
    }
  }

  // Exact match of Baijnath+Nitish.xlsx rows 19-23. Aggregates: 33 planned /
  // 31 present / 62 OT / 310 man-hours (verified against the TOTAL LABOUR row).
  // Note: the source's totalManHours is the formula (actualPresent * 8) +
  // otHours — NOT actualPresent * standardShiftHours as lib/calculations.ts
  // suggests (I8: it is only ever a suggested default, never an overwrite).
  const labourRows: Array<{
    labourCategory: string;
    contractorGangLeader: string;
    plannedStaff: number;
    actualPresent: number;
    otHours: number;
    totalManHours: number;
    assignedWorkArea: string;
    outputDeliveredToday: string;
    targetStdRate: string;
    productivityCheck: ProductivityCheck;
    supervisorRemarks?: string;
  }> = [
    {
      labourCategory: "Carpenter (Formwork)",
      contractorGangLeader: "Apex Civil Ltd",
      plannedStaff: 6,
      actualPresent: 6,
      otHours: 12,
      totalManHours: 60, // (6*8)+12
      assignedWorkArea: "Zone A Footings",
      outputDeliveredToday: "120 SqM Formwork",
      targetStdRate: "20 SqM / Man-Day",
      productivityCheck: "NORMAL",
      supervisorRemarks: "Good output, accurate shuttering",
    },
    {
      labourCategory: "Mason (Brick/PCC)",
      contractorGangLeader: "Apex Civil Ltd",
      plannedStaff: 4,
      actualPresent: 4,
      otHours: 8,
      totalManHours: 40, // (4*8)+8
      assignedWorkArea: "Zone B Slab",
      outputDeliveredToday: "85 CuM PCC",
      targetStdRate: "20 CuM / Man-Day",
      productivityCheck: "HIGH",
      supervisorRemarks: "Excellent work speed",
    },
    {
      labourCategory: "Welder (Structural)",
      contractorGangLeader: "TechSteel Sub",
      plannedStaff: 3,
      actualPresent: 2,
      otHours: 4,
      totalManHours: 20, // (2*8)+4
      assignedWorkArea: "Zone B Retaining Wall",
      outputDeliveredToday: "30 Joints",
      targetStdRate: "12 Joints / Man-Day",
      productivityCheck: "LOW",
      supervisorRemarks: "1 Welder absent without notice",
    },
    {
      labourCategory: "Bar Bender (Rebar)",
      contractorGangLeader: "Apex Civil Ltd",
      plannedStaff: 8,
      actualPresent: 8,
      // Engineer-entered figure — deliberately NOT actualPresent*8+otHours in
      // the general case; kept exactly as entered, per ARCHITECTURE §2.1.
      otHours: 16,
      totalManHours: 80, // (8*8)+16
      assignedWorkArea: "Zone A Footing & Column",
      outputDeliveredToday: "1,400 Kg Steel",
      targetStdRate: "180 Kg / Man-Day",
      productivityCheck: "NORMAL",
      supervisorRemarks: "Sufficient output for day",
    },
    {
      labourCategory: "Helper / Unskilled",
      contractorGangLeader: "Apex Civil Ltd",
      plannedStaff: 12,
      actualPresent: 11,
      otHours: 22,
      totalManHours: 110, // (11*8)+22
      assignedWorkArea: "Site Wide / All Zones",
      outputDeliveredToday: "Material shift & PCC support",
      targetStdRate: "N/A",
      productivityCheck: "NORMAL",
      supervisorRemarks: "Assisted masons and rebar team",
    },
  ];

  for (let i = 0; i < labourRows.length; i++) {
    const l = labourRows[i];
    const existing = await prisma.labourRow.findFirst({
      where: { sectionId: labourSection.id, labourCategory: l.labourCategory },
    });
    const data = {
      sectionId: labourSection.id,
      sortOrder: i,
      labourCategory: l.labourCategory,
      contractorGangLeader: l.contractorGangLeader,
      plannedStaff: l.plannedStaff,
      actualPresent: l.actualPresent,
      otHours: l.otHours,
      totalManHours: l.totalManHours,
      assignedWorkArea: l.assignedWorkArea,
      outputDeliveredToday: l.outputDeliveredToday,
      targetStdRate: l.targetStdRate,
      productivityCheck: l.productivityCheck,
      supervisorRemarks: l.supervisorRemarks ?? null,
    };
    if (existing) {
      await prisma.labourRow.update({ where: { id: existing.id }, data });
    } else {
      await prisma.labourRow.create({ data });
    }
  }

  console.log(`  report: ${report.reportDate.toISOString().slice(0, 10)} (${taskRows.length} task rows, ${labourRows.length} labour rows)`);

  return { report, workSection };
}

async function seedCorrectiveActions(
  siteId: string,
  reportId: string,
  adminId: string,
  engineerId: string
) {
  const tsk03 = await prisma.taskRow.findFirst({ where: { taskCode: "TSK-03" } });

  const overdueDue = new Date(Date.UTC(2026, 7, 1)); // 2026-08-01, before "today"
  const existingOpen = await prisma.correctiveAction.findFirst({
    where: { siteId, title: "Arrange backup generator" },
  });
  if (!existingOpen) {
    await prisma.correctiveAction.create({
      data: {
        siteId,
        reportId,
        taskRowId: tsk03?.id,
        title: "Arrange backup generator",
        description: "Conduit laying stalled 3 hours due to power outage.",
        guidance: "Arrange a backup diesel generator on standby for Zone B for the remainder of the week.",
        status: "OPEN",
        priority: "HIGH",
        dueDate: overdueDue,
        assignedToId: engineerId,
        createdById: adminId,
      },
    });
  }

  const existingClosed = await prisma.correctiveAction.findFirst({
    where: { siteId, title: "Resolve cement bag shortage" },
  });
  if (!existingClosed) {
    await prisma.correctiveAction.create({
      data: {
        siteId,
        reportId,
        title: "Resolve cement bag shortage",
        description: "Plastering work on Zone A internal walls on hold.",
        guidance: "Expedite cement delivery from the depot; confirm with supplier by EOD.",
        status: "CLOSED",
        priority: "MEDIUM",
        dueDate: new Date(Date.UTC(2026, 7, 3)),
        assignedToId: engineerId,
        createdById: adminId,
        closedById: adminId,
        closedAt: new Date(Date.UTC(2026, 7, 4)),
        closureNote: "Material delivered; plastering work resumed.",
      },
    });
  }

  console.log("  corrective actions: 1 OPEN (overdue), 1 CLOSED");
}

async function main() {
  console.log("Seeding dpr-site-control...");

  const { admin, engineer, supervisor } = await seedUsers();
  const site = await seedSite();
  await seedMemberships(site.id, [engineer.id, supervisor.id]);

  await seedFieldTemplate("WORK_PROGRAMME", WORK_PROGRAMME_FIELDS);
  await seedFieldTemplate("LABOUR_DEPLOYMENT", LABOUR_FIELDS);

  // Site-level overrides win over the global template in getFieldDefinitions —
  // keep their active/required flags aligned with the simplified labour form.
  for (const f of LABOUR_FIELDS) {
    await prisma.fieldDefinition.updateMany({
      where: { sectionType: "LABOUR_DEPLOYMENT", key: f.key, siteId: { not: null } },
      data: {
        label: f.label,
        fieldType: f.fieldType,
        order: f.order,
        isRequired: f.isRequired ?? false,
        isActive: f.isActive ?? true,
        isSystem: f.isSystem ?? true,
        options: f.options ?? [],
        placeholder: f.placeholder ?? null,
        helpText: f.helpText ?? null,
      },
    });
  }

  const { report } = await seedSampleReport(
    site.id,
    engineer.id,
    supervisor.id,
    engineer.name,
    supervisor.name
  );

  await seedCorrectiveActions(site.id, report.id, admin.id, engineer.id);

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
