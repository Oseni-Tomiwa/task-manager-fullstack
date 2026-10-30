import { expect, it } from "vitest";
import { User } from "../src/models/user.js";
const valid = {
  name: "Demo User",
  email: "demo@example.com",
  passwordHash: "test-hash-not-a-plaintext-password",
};
it("validates an unsaved user and normalizes name/email", async () => {
  const user = new User({
    ...valid,
    name: " Demo User ",
    email: " DEMO@Example.COM ",
  });
  await expect(user.validate()).resolves.toBeUndefined();
  expect(user.name).toBe("Demo User");
  expect(user.email).toBe("demo@example.com");
});
it.each(["name", "email", "passwordHash"])("requires %s", async (field) => {
  const input = { ...valid, [field]: undefined };
  await expect(new User(input).validate()).rejects.toHaveProperty(
    "errors." + field,
  );
});
it.each([
  { name: "   " },
  { name: "x".repeat(81) },
  { email: "invalid" },
  { email: "a".repeat(245) + "@example.com" },
  { passwordHash: "" },
  { passwordHash: "x".repeat(256) },
])("rejects invalid user data %j", async (patch) => {
  await expect(new User({ ...valid, ...patch }).validate()).rejects.toThrow();
});
it("defines a unique email index and a password hash excluded from queries", () => {
  expect(User.schema.indexes()).toContainEqual([
    { email: 1 },
    { unique: true },
  ]);
  expect(User.schema.path("passwordHash").options.select).toBe(false);
  expect(User.schema.path("password")).toBeUndefined();
  expect(User.schema.options.timestamps).toBe(true);
});
it("rejects unexpected fields including a plaintext password", () => {
  expect(() => new User({ ...valid, password: "plaintext" })).toThrow();
});
it("removes a hash from JSON even when explicitly present in a document", () => {
  expect(new User(valid).toJSON()).not.toHaveProperty("passwordHash");
  expect(User.schema.path("createdAt")).toBeDefined();
  expect(User.schema.path("updatedAt")).toBeDefined();
});
