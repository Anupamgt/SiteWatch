import { z } from "zod";

export const ticketStatusSchema = z.enum(["OPEN", "IN_PROGRESS", "DONE", "CLOSED"]);

export const createTicketSchema = z.object({
  siteId: z.string().cuid(),
  title: z.string().trim().min(1).max(200),
  description: z
    .string()
    .trim()
    .max(5000)
    .optional()
    .nullable()
    .transform((v) => (v == null || v === "" ? null : v)),
  assigneeIds: z.array(z.string().cuid()).min(1, "Select at least one assignee"),
});

export const updateTicketSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z
    .string()
    .trim()
    .max(5000)
    .optional()
    .nullable()
    .transform((v) => (v == null || v === "" ? null : v)),
  assigneeIds: z.array(z.string().cuid()).min(1).optional(),
  status: ticketStatusSchema.optional(),
});
