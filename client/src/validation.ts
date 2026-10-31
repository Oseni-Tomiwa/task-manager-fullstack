import { TASK_STATUSES } from "./api/contracts";
import type { LoginInput } from "./api/contracts";
export type FieldErrors = Partial<
  Record<
    "name" | "email" | "password" | "title" | "description" | "status",
    string
  >
>;
export function validateCredentials(
  values: LoginInput & { name?: string },
  register: boolean,
): FieldErrors {
  const errors: FieldErrors = {};
  if (register && (!values.name?.trim() || values.name.trim().length > 80))
    errors.name = "Enter your name (1–80 characters).";
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()) ||
    values.email.trim().length > 254
  )
    errors.email = "Enter a valid email address (up to 254 characters).";
  if (
    Array.from(values.password).length < 12 ||
    values.password.length > 72 ||
    new TextEncoder().encode(values.password).length > 72
  )
    errors.password =
      "Use at least 12 characters and no more than 72 UTF-8 bytes.";
  return errors;
}
export function validateTask(values: {
  title: string;
  description: string;
  status: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.title.trim() || values.title.trim().length > 120)
    errors.title = "Give your task a title (1–120 characters).";
  if (values.description.trim().length > 2000)
    errors.description = "Use no more than 2000 characters.";
  if (!TASK_STATUSES.some((status) => status === values.status))
    errors.status = "Choose a valid task status.";
  return errors;
}
