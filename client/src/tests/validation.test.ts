import { expect, it } from "vitest";
import { validateCredentials, validateTask } from "../validation";
it("validates normalized user fields without altering password whitespace", () => {
  expect(
    validateCredentials({ name: "   ", email: "bad", password: "short" }, true),
  ).toEqual(
    expect.objectContaining({
      name: expect.any(String),
      email: expect.any(String),
      password: expect.any(String),
    }),
  );
  expect(
    validateCredentials(
      {
        name: "Demo",
        email: " DEMO@example.com ",
        password: "  long password  ",
      },
      true,
    ),
  ).toEqual({});
});
it("counts Unicode code points and enforces the bcrypt UTF-8 byte ceiling", () => {
  expect(
    validateCredentials(
      { email: "a@example.com", password: "😀".repeat(6) },
      false,
    ),
  ).toHaveProperty("password");
  expect(
    validateCredentials(
      { email: "a@example.com", password: "😀".repeat(19) },
      false,
    ),
  ).toHaveProperty("password");
  expect(
    validateCredentials(
      { email: "a@example.com", password: "😀".repeat(12) },
      false,
    ),
  ).toEqual({});
  expect(
    validateCredentials(
      { email: "a@example.com", password: "x".repeat(73) },
      false,
    ),
  ).toHaveProperty("password");
});
it("rejects blank or oversized task fields and legacy mock status values", () => {
  expect(
    validateTask({ title: "  ", description: "", status: "todo" }),
  ).toHaveProperty("title");
  expect(
    validateTask({
      title: "x".repeat(121),
      description: "x".repeat(2001),
      status: "pending",
    }),
  ).toEqual(
    expect.objectContaining({
      title: expect.any(String),
      description: expect.any(String),
      status: expect.any(String),
    }),
  );
  expect(
    validateTask({ title: " Task ", description: "", status: "in_progress" }),
  ).toEqual({});
});
