import { z } from "zod";

export const machineOwnershipSchema = z.enum(["OWNED", "RENTED"]);
export const machineStatusSchema = z.enum(["ACTIVE", "IDLE", "UNDER_MAINTENANCE", "OFFSITE"]);

const optionalText = z
  .string()
  .trim()
  .max(200)
  .optional()
  .nullable()
  .transform((v) => (v == null || v === "" ? null : v));

export const createMachineSchema = z.object({
  siteId: z.string().cuid(),
  name: z.string().trim().min(1).max(120),
  category: optionalText,
  ownership: machineOwnershipSchema.default("OWNED"),
  status: machineStatusSchema.default("ACTIVE"),
  ownerLabel: optionalText,
  registration: optionalText,
  dailyRate: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => {
      if (v == null || v === "") return null;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : null;
    }),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => (v == null || v === "" ? null : v)),
  isActive: z.boolean().optional().default(true),
});

export const updateMachineSchema = createMachineSchema.partial().extend({
  siteId: z.string().cuid().optional(),
  name: z.string().trim().min(1).max(120).optional(),
});
