import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  HOST: z.string().trim().min(1).default("127.0.0.1"),
  PORT: z
    .string()
    .regex(/^\d+$/)
    .default("3000")
    .transform(Number)
    .pipe(z.number().int().min(1).max(65535)),
});
export type Env = z.infer<typeof schema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const keys = [
      ...new Set(result.error.issues.map((issue) => issue.path[0])),
    ].join(", ");
    throw new Error(`Invalid environment configuration: ${keys}`);
  }
  return result.data;
}
