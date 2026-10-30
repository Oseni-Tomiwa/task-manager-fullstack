import { expect, it } from "vitest";
import { parseEnv, parseStartupEnv } from "../src/config/env.js";
it.each([
  "mongodb://127.0.0.1:27017/taskflow",
  "mongodb+srv://example.invalid/taskflow",
])("accepts MongoDB URI syntax without connecting: %s", (MONGODB_URI) => {
  expect(parseStartupEnv({ MONGODB_URI }).MONGODB_URI).toBe(MONGODB_URI);
});
it("requires a URI for startup but not for standalone app configuration", () => {
  expect(parseEnv({}).MONGODB_URI).toBeUndefined();
  expect(() => parseStartupEnv({})).toThrow(
    "Invalid environment configuration: MONGODB_URI",
  );
});
it.each([
  "",
  "https://example.invalid",
  "mongodb://",
  "mongodb+srv://host:27017/db",
])("rejects invalid MongoDB URI %j without exposing it", (MONGODB_URI) => {
  expect(() => parseEnv({ MONGODB_URI })).toThrow(
    "Invalid environment configuration: MONGODB_URI",
  );
});
