import { z } from "zod";

export const siteCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => /^[A-Z0-9]{2,8}$/.test(v), "Code must be 2–8 letters/digits"),
  name: z.string().trim().min(1).max(120),
  projectName: z.string().trim().min(1).max(120),
  locationZone: z.string().trim().max(120).optional().nullable(),
  contractorClient: z.string().trim().max(120).optional().nullable(),
  standardShiftHours: z.coerce.number().positive().max(24).optional(),
  isActive: z.boolean().optional(),
});

export const siteUpdateSchema = siteCreateSchema.partial().omit({ code: true }).extend({
  code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => /^[A-Z0-9]{2,8}$/.test(v), "Code must be 2–8 letters/digits")
    .optional(),
});

export const userCreateSchema = z.object({
  email: z.string().trim().email().transform((v) => v.toLowerCase()),
  name: z.string().trim().min(1).max(120),
  role: z.enum(["ENGINEER", "ADMIN"]),
  phone: z.string().trim().max(40).optional().nullable(),
  password: z.string().min(6).max(128).optional(),
  isActive: z.boolean().optional(),
  siteIds: z.array(z.string().min(1)).optional(),
});

export const userUpdateSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .transform((v) => v.toLowerCase())
    .optional(),
  name: z.string().trim().min(1).max(120).optional(),
  role: z.enum(["ENGINEER", "ADMIN"]).optional(),
  phone: z.string().trim().max(40).optional().nullable(),
  password: z.string().min(6).max(128).optional().nullable(),
  isActive: z.boolean().optional(),
  siteIds: z.array(z.string().min(1)).optional(),
});

export const memberSchema = z.object({
  userId: z.string().min(1),
});

export const fieldCreateSchema = z.object({
  sectionType: z.enum(["WORK_PROGRAMME", "LABOUR_DEPLOYMENT"]),
  key: z
    .string()
    .trim()
    .regex(/^[a-z][a-zA-Z0-9]*$/, "Key must be camelCase"),
  label: z.string().trim().min(1).max(120),
  fieldType: z.enum([
    "TEXT",
    "TEXTAREA",
    "NUMBER",
    "DECIMAL",
    "DATE",
    "SELECT",
    "MULTISELECT",
    "BOOLEAN",
    "PERCENT",
    "PHOTO",
  ]),
  isRequired: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional().nullable(),
  helpText: z.string().optional().nullable(),
  defaultValue: z.string().optional().nullable(),
});

export const fieldUpdateSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  isRequired: z.boolean().optional(),
  isActive: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional().nullable(),
  helpText: z.string().optional().nullable(),
  defaultValue: z.string().optional().nullable(),
  fieldType: z
    .enum([
      "TEXT",
      "TEXTAREA",
      "NUMBER",
      "DECIMAL",
      "DATE",
      "SELECT",
      "MULTISELECT",
      "BOOLEAN",
      "PERCENT",
      "PHOTO",
    ])
    .optional(),
});

export const fieldReorderSchema = z.object({
  sectionType: z.enum(["WORK_PROGRAMME", "LABOUR_DEPLOYMENT"]),
  orderedKeys: z.array(z.string().min(1)).min(1),
});

export const reportHeaderSchema = z.object({
  siteEngineerName: z.string().trim().max(120).optional().nullable(),
  siteSupervisorName: z.string().trim().max(120).optional().nullable(),
  weatherCondition: z.string().trim().max(120).optional().nullable(),
  locationZone: z.string().trim().max(120).optional().nullable(),
  contractorClient: z.string().trim().max(120).optional().nullable(),
  projectName: z.string().trim().max(120).optional(),
});

export const correctiveActionCreateSchema = z.object({
  siteId: z.string().min(1),
  reportId: z.string().optional().nullable(),
  taskRowId: z.string().optional().nullable(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  guidance: z.string().trim().max(2000).optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  assignedToId: z.string().min(1),
});

export const correctiveActionPatchSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]).optional(),
  closureNote: z.string().trim().max(2000).optional().nullable(),
  guidance: z.string().trim().max(2000).optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
});
