import { z } from "zod";

const authSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    JWT_SECRET: z.string().regex(/^[a-f\d]{64}$/i),
    CLIENT_ORIGIN: z.string().refine((value) => {
      try {
        const url = new URL(value);
        return (
          url.origin === value &&
          (url.protocol === "https:" ||
            (url.protocol === "http:" &&
              ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
        );
      } catch {
        return false;
      }
    }),
  })
  .superRefine((config, context) => {
    if (
      config.NODE_ENV === "production" &&
      !config.CLIENT_ORIGIN.startsWith("https://")
    )
      context.addIssue({
        code: "custom",
        path: ["CLIENT_ORIGIN"],
        message: "HTTPS required.",
      });
  });
export type AuthConfig = z.infer<typeof authSchema>;
export function parseAuthEnv(
  source: Record<string, string | undefined>,
): AuthConfig {
  const result = authSchema.safeParse(source);
  if (!result.success)
    throw new Error(
      `Invalid authentication configuration: ${[...new Set(result.error.issues.map((issue) => issue.path[0]))].join(", ")}`,
    );
  return result.data;
}
