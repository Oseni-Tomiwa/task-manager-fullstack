import { afterEach, expect, it, vi } from "vitest";
import { diagnoseStartup, diagnoseApp } from "../src/startup-diagnostics.js";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const enable = () => {
  vi.stubEnv("STARTUP_DIAGNOSTICS", "1");
  return vi.spyOn(console, "info").mockImplementation(() => undefined);
};
it.each([undefined, "0", "true", " 1", "1 "])(
  "is silent unless explicitly enabled (%s)",
  async (value) => {
    vi.stubEnv("STARTUP_DIAGNOSTICS", value);
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await expect(
      diagnoseStartup("user_init", async () => {
        throw new Error("private");
      }),
    ).rejects.toThrow("private");
    expect(log).not.toHaveBeenCalled();
  },
);
it.each([
  [{ name: "MongoParseError" }, "connection_configuration", undefined],
  [{ code: "ENOTFOUND" }, "dns", "ENOTFOUND"],
  [{ cause: { code: "ECONNREFUSED" } }, "network", "ECONNREFUSED"],
  [{ code: "CERT_HAS_EXPIRED" }, "tls", "CERT_HAS_EXPIRED"],
  [{ code: 18 }, "authentication", 18],
  [{ codeName: "AuthenticationFailed" }, "authentication", 18],
  [{ code: 13 }, "authorization", 13],
  [{ code: 11000 }, "duplicate_key", 11000],
  [{ code: 85 }, "index_conflict", 85],
  [{ code: 86 }, "index_conflict", 86],
  [
    { name: "MongooseServerSelectionError" },
    "server_selection_unknown",
    undefined,
  ],
  [
    {
      name: "MongoServerSelectionError",
      reason: {
        servers: new Map([
          ["private-host", { error: { cause: { code: 18 } } }],
        ]),
      },
    },
    "authentication",
    18,
  ],
  [
    { code: "unrecognized-private-code", message: "authentication failed" },
    "unknown",
    undefined,
  ],
] as const)(
  "classifies allowlisted signals without forwarding errors",
  async (error, category, code) => {
    const log = enable();
    await expect(
      diagnoseStartup("database_connect", async () => {
        throw error;
      }),
    ).rejects.toBe(error);
    expect(JSON.parse(log.mock.calls[0]![0])).toEqual({
      event: "startup_diagnostic",
      stage: "database_connect",
      result: "failed",
      category,
      ...(code === undefined ? {} : { code }),
    });
  },
);
it("keeps HTTP failures distinct", async () => {
  const log = enable();
  await expect(
    diagnoseStartup("http_bind", async () => {
      throw { code: "EADDRINUSE" };
    }),
  ).rejects.toEqual({ code: "EADDRINUSE" });
  expect(JSON.parse(log.mock.calls[0]![0])).toMatchObject({
    stage: "http_bind",
    category: "http_binding",
    code: "EADDRINUSE",
  });
});
it("preserves app identity and synchronous exceptions", () => {
  const log = enable();
  const app = {};
  expect(diagnoseApp(() => app)).toBe(app);
  const error = new Error("private");
  expect(() =>
    diagnoseApp(() => {
      throw error;
    }),
  ).toThrow(error);
  expect(log.mock.calls.map(([line]) => JSON.parse(line).result)).toEqual([
    "ok",
    "failed",
  ]);
});
it("preserves async results and never logs supplied secrets", async () => {
  const log = enable();
  const secret = "SECRET_URI_PASSWORD_TOKEN_HOST_STACK";
  const error = Object.assign(new Error(secret), {
    stack: secret,
    code: secret,
    name: secret,
    codeName: secret,
    cause: { code: 13, password: secret },
    reason: { servers: new Map([[secret, { error: { message: secret } }]]) },
    toJSON: () => {
      throw new Error("must not serialize");
    },
  });
  expect(await diagnoseStartup("user_init", async () => secret)).toBe(secret);
  await expect(
    diagnoseStartup("user_init", async () => {
      throw error;
    }),
  ).rejects.toBe(error);
  const output = log.mock.calls.map(([line]) => line).join("\n");
  expect(output).not.toContain(secret);
  expect(JSON.parse(log.mock.calls[1]![0])).toEqual({
    event: "startup_diagnostic",
    stage: "user_init",
    result: "failed",
    category: "authorization",
    code: 13,
  });
});
it("bounds cyclic, deep, wide and hostile inspection", async () => {
  const log = enable();
  const cyclic: { cause?: unknown } = {};
  cyclic.cause = cyclic;
  let deep: unknown = { code: 18 };
  for (let i = 0; i < 30; i++) deep = { cause: deep };
  const hostile = new Proxy(
    {},
    {
      get() {
        throw new Error("private");
      },
    },
  );
  const wide = {
    reason: {
      servers: new Map(
        Array.from({ length: 100 }, (_, i) => [
          String(i),
          { error: i === 99 ? { code: 18 } : {} },
        ]),
      ),
    },
  };
  for (const error of [cyclic, deep, hostile, wide]) {
    await expect(
      diagnoseStartup("database_connect", async () => {
        throw error;
      }),
    ).rejects.toBe(error);
  }
  expect(log.mock.calls.map(([line]) => JSON.parse(line).category)).toEqual([
    "unknown",
    "unknown",
    "unknown",
    "unknown",
  ]);
});
it("diagnostic output failures cannot change the operation result", async () => {
  vi.stubEnv("STARTUP_DIAGNOSTICS", "1");
  vi.spyOn(console, "info").mockImplementation(() => {
    throw new Error("logger unavailable");
  });
  expect(await diagnoseStartup("user_init", async () => 42)).toBe(42);
  expect(diagnoseApp(() => 42)).toBe(42);
});

it("never reads messages, stacks, credentials, or arbitrary properties", async () => {
  const log = enable();
  const forbidden = vi.fn(() => {
    throw new Error("must not inspect");
  });
  const error = Object.defineProperties(
    { cause: { code: 18 } },
    Object.fromEntries(
      ["message", "stack", "password", "uri", "token", "toJSON"].map((key) => [
        key,
        { get: forbidden },
      ]),
    ),
  );
  await expect(
    diagnoseStartup("database_connect", async () => {
      throw error;
    }),
  ).rejects.toBe(error);
  expect(forbidden).not.toHaveBeenCalled();
  expect(JSON.parse(log.mock.calls[0]![0]).category).toBe("authentication");
});
it("does not inspect errors when disabled", async () => {
  vi.stubEnv("STARTUP_DIAGNOSTICS", "0");
  const access = vi.fn();
  const error = new Proxy({}, { get: access });
  await expect(
    diagnoseStartup("database_connect", async () => {
      throw error;
    }),
  ).rejects.toBe(error);
  expect(access).not.toHaveBeenCalled();
});

it.each([
  [48, "existing_collection"],
  [8000, "atlas_rejection_unknown"],
] as const)(
  "recognizes additional code %s without guessing its cause",
  async (code, category) => {
    const log = enable();
    await expect(
      diagnoseStartup("user_init", async () => {
        throw { code, message: "PRIVATE" };
      }),
    ).rejects.toEqual({ code, message: "PRIVATE" });
    expect(JSON.parse(log.mock.calls[0]![0])).toEqual({
      event: "startup_diagnostic",
      stage: "user_init",
      result: "failed",
      category,
      code,
    });
  },
);

it.each([undefined, "0", "true", " 1", "1 "])(
  "keeps all refinement events silent for flag %s",
  async (flag) => {
    const { recordStartup, diagnoseDatabaseSelection } =
      await import("../src/startup-diagnostics.js");
    vi.stubEnv("STARTUP_DIAGNOSTICS", flag);
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const access = vi.fn();
    recordStartup("user_collection", "failed", new Proxy({}, { get: access }));
    recordStartup("user_email_index", "started");
    diagnoseDatabaseSelection("PRIVATE_DATABASE_URI_TOKEN");
    expect(log).not.toHaveBeenCalled();
    expect(access).not.toHaveBeenCalled();
  },
);
it.each([
  ["taskflow", true],
  ["PRIVATE_DATABASE_URI_TOKEN", false],
  [undefined, false],
] as const)(
  "emits only the database-match boolean",
  async (database, matches) => {
    const { diagnoseDatabaseSelection } =
      await import("../src/startup-diagnostics.js");
    const log = enable();
    diagnoseDatabaseSelection(database);
    expect(log.mock.calls).toEqual([
      [
        JSON.stringify({
          event: "startup_diagnostic",
          stage: "database_selection",
          database_matches_expected: matches,
        }),
      ],
    ]);
  },
);
it("cannot coerce the selected database or propagate a logger failure", async () => {
  const { diagnoseDatabaseSelection } =
    await import("../src/startup-diagnostics.js");
  const log = enable();
  const coercion = vi.fn(() => {
    throw new Error("PRIVATE");
  });
  diagnoseDatabaseSelection({ toString: coercion });
  expect(coercion).not.toHaveBeenCalled();
  expect(JSON.parse(log.mock.calls[0]![0]).database_matches_expected).toBe(
    false,
  );
  log.mockImplementation(() => {
    throw new Error("PRIVATE");
  });
  expect(() => diagnoseDatabaseSelection("taskflow")).not.toThrow();
});
