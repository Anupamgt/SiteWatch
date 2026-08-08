// Shared constants. Keep the timezone in one place so overdue/date comparisons
// never drift between server components, API routes, and the Excel exporter.
export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kolkata";

export const SECTION_TYPE_LABELS: Record<string, string> = {
  WORK_PROGRAMME: "Work Programme",
  LABOUR_DEPLOYMENT: "Labour Deployment",
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  DELAYED: "Delayed",
  ON_HOLD: "On Hold",
};

export const PRODUCTIVITY_LABELS: Record<string, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  NOT_APPLICABLE: "N/A",
};

export const DEFAULT_STANDARD_SHIFT_HOURS = 8;

/** Default labour trades shown as a pre-filled list on Labour Deployment. */
export const LABOUR_TYPES = [
  "Carpenter",
  "Mason",
  "Bar Bender",
  "Welder",
  "Gang Leader",
  "Operator",
  "Helper",
] as const;
