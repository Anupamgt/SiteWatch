import ExcelJS from "exceljs";
import type { ResolvedFieldDefinition } from "@/lib/fields";
import { TASK_STATUS_LABELS, PRODUCTIVITY_LABELS } from "@/lib/constants";
import { formatDateOnly } from "@/lib/dates";

export type WorkbookTaskRow = {
  sortOrder: number;
  taskCode: string | null;
  locationStructure: string | null;
  plannedWorkDescription: string | null;
  primaryTradeLead: string | null;
  targetQty: number | null;
  achievedQty: number | null;
  unit: string | null;
  percentComplete: number | null;
  status: string;
  varianceReason: string | null;
  correctiveActionNote: string | null;
  custom: Record<string, unknown>;
  attachmentCount?: number;
};

export type WorkbookLabourRow = {
  sortOrder: number;
  labourCategory: string | null;
  contractorGangLeader: string | null;
  plannedStaff: number | null;
  actualPresent: number | null;
  otHours: number | null;
  totalManHours: number | null;
  assignedWorkArea: string | null;
  outputDeliveredToday: string | null;
  targetStdRate: string | null;
  productivityCheck: string;
  supervisorRemarks: string | null;
  custom: Record<string, unknown>;
};

export type WorkbookReport = {
  reportDate: Date;
  projectName: string;
  locationZone: string | null;
  contractorClient: string | null;
  siteEngineerName: string | null;
  siteSupervisorName: string | null;
  weatherCondition: string | null;
  dayOfWeek: string | null;
  approvedByName: string | null;
  taskRows: WorkbookTaskRow[];
  labourRows: WorkbookLabourRow[];
};

const COL_WIDTHS = [18.43, 19.57, 34.86, 17.57, 15.71, 12.57, 20.86, 24, 16.86, 27, 30.14];

const SYSTEM_TASK_KEYS = [
  "taskCode",
  "locationStructure",
  "plannedWorkDescription",
  "primaryTradeLead",
  "targetQty",
  "achievedQty",
  "unit",
  "percentComplete",
  "status",
  "varianceReason",
  "correctiveActionNote",
] as const;

const SYSTEM_LABOUR_KEYS = [
  "labourCategory",
  "contractorGangLeader",
  "plannedStaff",
  "actualPresent",
  "otHours",
  "totalManHours",
  "assignedWorkArea",
  "outputDeliveredToday",
  "targetStdRate",
  "productivityCheck",
  "supervisorRemarks",
] as const;

function colLetter(index1: number): string {
  let n = index1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function cellValue(
  key: string,
  row: Record<string, unknown>,
  custom: Record<string, unknown>,
  isSystem: boolean,
  fieldType: string
): ExcelJS.CellValue {
  if (key === "status") {
    return TASK_STATUS_LABELS[String(row.status)] ?? String(row.status ?? "");
  }
  if (key === "productivityCheck") {
    return PRODUCTIVITY_LABELS[String(row.productivityCheck)] ?? String(row.productivityCheck ?? "");
  }
  if (fieldType === "PHOTO") {
    return Number(row.attachmentCount ?? 0);
  }
  const raw = isSystem ? row[key] : custom[key];
  if (raw == null || raw === "") return "";
  if (typeof raw === "number") return raw;
  if (typeof raw === "boolean") return raw ? "Yes" : "No";
  if (Array.isArray(raw)) return raw.join(", ");
  return String(raw);
}

function applyThinBorders(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };
  cell.alignment = { vertical: "middle", wrapText: true };
}

/**
 * Pure workbook builder — no Prisma. Column order comes from getFieldDefinitions
 * (invariant I3). Layout verified against Baijnath+Nitish.xlsx (REMAINING_WORK §8).
 */
export function buildReportWorkbook(
  reports: WorkbookReport[],
  fieldsByType: {
    WORK_PROGRAMME: ResolvedFieldDefinition[];
    LABOUR_DEPLOYMENT: ResolvedFieldDefinition[];
  }
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SiteWatch";

  for (const report of reports) {
    const sheetName = formatDateOnly(report.reportDate);
    const ws = wb.addWorksheet(sheetName);

    const taskFields = fieldsByType.WORK_PROGRAMME;
    const labourFields = fieldsByType.LABOUR_DEPLOYMENT;
    const taskColCount = Math.max(taskFields.length, 11);
    const labourColCount = Math.max(labourFields.length, 11);
    const maxCols = Math.max(taskColCount, labourColCount, 11);

    for (let i = 0; i < maxCols; i++) {
      ws.getColumn(i + 1).width = COL_WIDTHS[i] ?? 18;
    }

    // Title rows
    ws.mergeCells(1, 1, 1, Math.max(11, taskColCount));
    const title = ws.getCell(1, 1);
    title.value = "DAILY CONSTRUCTION SITE PROGRAMME & PROGRESS CONTROL REPORT";
    title.font = { bold: true, size: 14 };
    title.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 21;

    ws.mergeCells(2, 1, 2, Math.max(11, taskColCount));
    const subtitle = ws.getCell(2, 1);
    subtitle.value =
      "Head Office Control & Monitoring Sheet | Site Engineer & Supervisor Daily Accountability Log";
    subtitle.font = { italic: true, size: 10 };
    subtitle.alignment = { horizontal: "center", vertical: "middle" };

    // Header block rows 4–6
    const headerPairs: Array<[number, string, string | Date]> = [
      [4, "Project Name:", report.projectName],
      [4, "Date:", report.reportDate],
      [4, "Site Engineer:", report.siteEngineerName ?? ""],
      [5, "Location/Zone:", report.locationZone ?? ""],
      [5, "Day of Week:", report.dayOfWeek ?? ""],
      [5, "Site Supervisor:", report.siteSupervisorName ?? ""],
      [6, "Contractor/Client:", report.contractorClient ?? ""],
      [6, "Weather Condition:", report.weatherCondition ?? ""],
      [6, "Approved By (HO):", report.approvedByName ?? ""],
    ];

    // Exact layout: A/B, C/D, E/F on rows 4-6
    const layout: Array<[number, number, string, string | Date | null]> = [
      [4, 1, "Project Name:", report.projectName],
      [4, 3, "Date:", report.reportDate],
      [4, 5, "Site Engineer:", report.siteEngineerName ?? ""],
      [5, 1, "Location/Zone:", report.locationZone ?? ""],
      [5, 3, "Day of Week:", report.dayOfWeek ?? ""],
      [5, 5, "Site Supervisor:", report.siteSupervisorName ?? ""],
      [6, 1, "Contractor/Client:", report.contractorClient ?? ""],
      [6, 3, "Weather Condition:", report.weatherCondition ?? ""],
      [6, 5, "Approved By (HO):", report.approvedByName ?? ""],
    ];
    void headerPairs;

    for (const [row, col, label, value] of layout) {
      const labelCell = ws.getCell(row, col);
      labelCell.value = label;
      labelCell.font = { bold: true };
      const valueCell = ws.getCell(row, col + 1);
      valueCell.value = value ?? "";
      if (label === "Date:" && value instanceof Date) {
        valueCell.numFmt = "dd-mmm-yyyy";
      }
    }

    // Work programme banner
    const bannerRow = 8;
    ws.mergeCells(bannerRow, 1, bannerRow, Math.max(11, taskColCount));
    const banner = ws.getCell(bannerRow, 1);
    banner.value = "1. WORK PROGRAMME & TASK EXECUTION LOG (ENGINEER & SUPERVISOR)";
    banner.font = { bold: true, color: { argb: "FFFFFFFF" } };
    banner.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    banner.alignment = { horizontal: "left", vertical: "middle" };

    const taskHeaderRow = 9;
    ws.getRow(taskHeaderRow).height = 30;
    taskFields.forEach((f, i) => {
      const cell = ws.getCell(taskHeaderRow, i + 1);
      cell.value = f.label;
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
      applyThinBorders(cell);
    });

    const taskStart = 10;
    report.taskRows.forEach((row, idx) => {
      const r = taskStart + idx;
      const flat: Record<string, unknown> = { ...row, attachmentCount: row.attachmentCount ?? 0 };
      taskFields.forEach((f, i) => {
        const cell = ws.getCell(r, i + 1);
        cell.value = cellValue(f.key, flat, row.custom, f.isSystem, f.fieldType);
        applyThinBorders(cell);
        if (f.key === "targetQty" || f.key === "achievedQty") cell.numFmt = "#,##0";
        if (f.key === "percentComplete") cell.numFmt = "0.0%";
      });
    });

    const afterTasks = taskStart + report.taskRows.length; // blank row index
    // leave blank row at afterTasks

    const labourBannerRow = afterTasks + 1;
    ws.mergeCells(labourBannerRow, 1, labourBannerRow, Math.max(11, labourColCount));
    const labourBanner = ws.getCell(labourBannerRow, 1);
    labourBanner.value = "2. DAILY LABOUR DEPLOYMENT & PRODUCTIVITY CONTROL";
    labourBanner.font = { bold: true, color: { argb: "FFFFFFFF" } };
    labourBanner.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    const labourHeaderRow = labourBannerRow + 1;
    ws.getRow(labourHeaderRow).height = 45;
    labourFields.forEach((f, i) => {
      const cell = ws.getCell(labourHeaderRow, i + 1);
      cell.value = f.label;
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
      applyThinBorders(cell);
    });

    const labourStart = labourHeaderRow + 1;
    report.labourRows.forEach((row, idx) => {
      const r = labourStart + idx;
      const flat: Record<string, unknown> = { ...row };
      labourFields.forEach((f, i) => {
        const cell = ws.getCell(r, i + 1);
        cell.value = cellValue(f.key, flat, row.custom, f.isSystem, f.fieldType);
        applyThinBorders(cell);
        if (["plannedStaff", "actualPresent", "otHours", "totalManHours"].includes(f.key)) {
          cell.numFmt = "#,##0";
        }
      });
    });

    const labourEnd = labourStart + report.labourRows.length - 1;
    const totalsRow = labourEnd + 1;
    ws.getRow(totalsRow).height = 15.75;
    const totalsLabel = ws.getCell(totalsRow, 1);
    totalsLabel.value = "TOTAL LABOUR";
    totalsLabel.font = { bold: true };
    applyThinBorders(totalsLabel);

    const sumKeys = ["plannedStaff", "actualPresent", "otHours", "totalManHours"];
    labourFields.forEach((f, i) => {
      const cell = ws.getCell(totalsRow, i + 1);
      applyThinBorders(cell);
      if (sumKeys.includes(f.key) && report.labourRows.length > 0) {
        const letter = colLetter(i + 1);
        cell.value = { formula: `SUM(${letter}${labourStart}:${letter}${labourEnd})` };
        cell.numFmt = "#,##0";
        cell.font = { bold: true };
      } else if (i === 0) {
        // already set label
      }
    });
  }

  return wb;
}

/** Helper for tests / callers mapping Prisma rows into workbook shapes. */
export function defaultSystemFieldOrder(section: "WORK_PROGRAMME" | "LABOUR_DEPLOYMENT") {
  return section === "WORK_PROGRAMME" ? [...SYSTEM_TASK_KEYS] : [...SYSTEM_LABOUR_KEYS];
}
