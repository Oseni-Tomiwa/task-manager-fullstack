import { randomBytes } from "node:crypto";
import { expect, it } from "vitest";
import { parseAuthEnv } from "../src/config/auth.js";
const secret = randomBytes(32).toString("hex");
it("requires a signing secret and an explicit frontend origin", () => {
  expect(() => parseAuthEnv({})).toThrow(
    "Invalid authentication configuration:",
  );
});
it.each(["", "short", "replace-with-output-of-openssl-rand-hex-32"])(
  "rejects an invalid signing secret without exposing its value",
  (JWT_SECRET) => {
    expect(() =>
      parseAuthEnv({ JWT_SECRET, CLIENT_ORIGIN: "http://127.0.0.1:5173" }),
    ).toThrow("JWT_SECRET");
  },
);
it.each([
  "*",
  "null",
  "https://example.com/path",
  "https://user:pass@example.com",
  "https://example.com/",
  "http://example.com",
])("rejects unsafe origins in production: %s", (CLIENT_ORIGIN) => {
  expect(() =>
    parseAuthEnv({ JWT_SECRET: secret, CLIENT_ORIGIN, NODE_ENV: "production" }),
  ).toThrow("CLIENT_ORIGIN");
});
it("allows a local origin in development and HTTPS in production", () => {
  expect(
    parseAuthEnv({ JWT_SECRET: secret, CLIENT_ORIGIN: "http://127.0.0.1:5173" })
      .CLIENT_ORIGIN,
  ).toBe("http://127.0.0.1:5173");
  expect(
    parseAuthEnv({
      JWT_SECRET: secret,
      CLIENT_ORIGIN: "https://example.com",
      NODE_ENV: "production",
    }).NODE_ENV,
  ).toBe("production");
});
