/**
 * Single shared status-color mapping so badge colours never drift between
 * the engineer UI, the admin dashboard, and (later) the Excel export notes.
 * Styled as Atlassian Design System lozenges.
 * See ARCHITECTURE.md §6.
 */
const COLOR_MAP: Record<string, string> = {
  COMPLETED: "bg-[#dcfff1] text-[#216e4e]",
  CLOSED: "bg-[#dcfff1] text-[#216e4e]",
  SUBMITTED: "bg-[#dcfff1] text-[#216e4e]",
  IN_PROGRESS: "bg-[#e9f2ff] text-[#0055cc]",
  NOT_STARTED: "bg-[#f1f2f4] text-[#44546f]",
  DRAFT: "bg-[#f1f2f4] text-[#44546f]",
  DELAYED: "bg-[#ffeceb] text-[#ae2e24]",
  OVERDUE: "bg-[#ffeceb] text-[#ae2e24]",
  ON_HOLD: "bg-[#fff7d6] text-[#974f0c]",
  OPEN: "bg-[#e9f2ff] text-[#0055cc]",
  HIGH: "bg-[#dcfff1] text-[#216e4e]",
  NORMAL: "bg-[#f1f2f4] text-[#44546f]",
  LOW: "bg-[#ffeceb] text-[#ae2e24]",
  NOT_APPLICABLE: "bg-[#f1f2f4] text-[#626f86]",
};

const LABEL_OVERRIDES: Record<string, string> = {
  IN_PROGRESS: "In progress",
  NOT_STARTED: "Not started",
  ON_HOLD: "On hold",
  NOT_APPLICABLE: "N/A",
};

export function StatusBadge({ value, className }: { value: string; className?: string }) {
  const color = COLOR_MAP[value] ?? "bg-[#f1f2f4] text-[#44546f]";
  const label = LABEL_OVERRIDES[value] ?? value.charAt(0) + value.slice(1).toLowerCase();
  return (
    <span className={`ads-lozenge ${color} ${className ?? ""}`}>
      {label}
    </span>
  );
}
