import { z } from "zod";
const email = z.string().trim().toLowerCase().max(254).pipe(z.email());
const password = z
  .string()
  .max(72)
  .refine((value) => Array.from(value).length >= 12, {
    message: "Use at least 12 characters.",
  })
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, {
    message: "Use no more than 72 UTF-8 bytes.",
  });
export const registrationSchema = z
  .object({ name: z.string().trim().min(1).max(80), email, password })
  .strict();
export const loginSchema = z.object({ email, password }).strict();
