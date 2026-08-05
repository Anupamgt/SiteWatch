import { DEFAULT_STANDARD_SHIFT_HOURS } from "@/lib/constants";

/**
 * percentComplete is a FRACTION (0.9333, 1.0625, ...), never 0-100, and is
 * never clamped — a task can legitimately exceed 100%. Only fill it in when
 * the caller hasn't supplied a value themselves; an explicit value (including
 * one the engineer typed by hand) always wins. This is what "recompute on
 * save, but allow manual override" means in practice.
 */
export function withDefaultPercentComplete<
  T extends { targetQty?: number | null; achievedQty?: number | null; percentComplete?: number | null }
>(row: T): T {
  if (row.percentComplete != null) return row;
  const target = row.targetQty;
  const achieved = row.achievedQty;
  if (target != null && achieved != null && target > 0) {
    return { ...row, percentComplete: achieved / target };
  }
  return row;
}

/**
 * totalManHours is engineer-entered and must never be silently overwritten.
 * Only suggest actualPresent * standardShiftHours when the field is empty.
 */
export function withDefaultTotalManHours<
  T extends { actualPresent?: number | null; totalManHours?: number | null }
>(row: T, standardShiftHours: number = DEFAULT_STANDARD_SHIFT_HOURS): T {
  if (row.totalManHours != null) return row;
  if (row.actualPresent != null) {
    return { ...row, totalManHours: row.actualPresent * standardShiftHours };
  }
  return row;
}
