import { z } from "zod";
import { TASK_STATUSES } from "../models/task.js";
const title = z.string().trim().min(1).max(120);
const description = z.string().trim().max(2000);
const status = z.enum(TASK_STATUSES);
export const createTaskSchema = z
  .object({
    title,
    description: description.default(""),
    status: status.default("todo"),
  })
  .strict();
// Do not inherit create defaults into PATCH: omitted fields must remain untouched.
export const updateTaskSchema = z
  .object({
    title: title.optional(),
    description: description.optional(),
    status: status.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Supply at least one editable field.",
  });
const positiveInteger = (fallback: string, max: number) =>
  z
    .string()
    .regex(/^\d+$/)
    .default(fallback)
    .transform(Number)
    .pipe(z.number().int().min(1).max(max));
export const taskQuerySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    status: status.optional(),
    page: positiveInteger("1", 10000),
    limit: positiveInteger("20", 100),
  })
  .strict();
export const taskIdSchema = z.string().regex(/^[a-f\d]{24}$/i);
export function escapeSearch(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
