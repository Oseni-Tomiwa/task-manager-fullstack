import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/config/env.js";

describe("environment configuration", () => {
  it("uses safe local defaults and typed values", () => {
    expect(parseEnv({})).toEqual({
      NODE_ENV: "development",
      HOST: "127.0.0.1",
      PORT: 3000,
    });
    expect(
      parseEnv({ NODE_ENV: "production", HOST: "0.0.0.0", PORT: "8080" }).PORT,
    ).toBe(8080);
  });
  it.each(["", "0", "-1", "65536", "3.5", "abc"])(
    "rejects invalid port %j",
    (PORT) => {
      expect(() => parseEnv({ PORT })).toThrow(
        "Invalid environment configuration: PORT",
      );
    },
  );
  it("rejects unknown environments without logging values", () => {
    expect(() => parseEnv({ NODE_ENV: "sensitive-value" })).toThrow(
      "Invalid environment configuration: NODE_ENV",
    );
  });
  it("rejects an empty host", () => {
    expect(() => parseEnv({ HOST: "" })).toThrow(
      "Invalid environment configuration: HOST",
    );
  });
});
