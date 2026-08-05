/**
 * Single shared status-color mapping so badge colours never drift between
 * the engineer UI, the admin dashboard, and (later) the Excel export notes.
 * See ARCHITECTURE.md §6.
 */
const COLOR_MAP: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-800",
  CLOSED: "bg-green-100 text-green-800",
  SUBMITTED: "bg-green-100 text-green-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  NOT_STARTED: "bg-slate-100 text-slate-700",
  DRAFT: "bg-slate-100 text-slate-700",
  DELAYED: "bg-red-100 text-red-800",
  OVERDUE: "bg-red-100 text-red-800",
  ON_HOLD: "bg-amber-100 text-amber-800",
  OPEN: "bg-slate-200 text-slate-800",
  HIGH: "bg-green-100 text-green-800",
  NORMAL: "bg-slate-100 text-slate-700",
  LOW: "bg-red-100 text-red-800",
  NOT_APPLICABLE: "bg-slate-100 text-slate-500",
};

const LABEL_OVERRIDES: Record<string, string> = {
  IN_PROGRESS: "In Progress",
  NOT_STARTED: "Not Started",
  ON_HOLD: "On Hold",
  NOT_APPLICABLE: "N/A",
};

export function StatusBadge({ value, className }: { value: string; className?: string }) {
  const color = COLOR_MAP[value] ?? "bg-slate-100 text-slate-700";
  const label = LABEL_OVERRIDES[value] ?? value.charAt(0) + value.slice(1).toLowerCase();
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color} ${className ?? ""}`}
    >
      {label}
    </span>
  );
}
