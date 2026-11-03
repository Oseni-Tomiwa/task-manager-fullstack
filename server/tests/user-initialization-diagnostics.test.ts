import mongoose from "mongoose";
import { afterEach, expect, it, vi } from "vitest";

// Access Mongoose internals only to substitute the database boundary in tests.
const connection = mongoose.connection as unknown as {
  readyState: number;
  db: unknown;
  onOpen(): void;
};
// Actual schema and Mongoose init pipeline; only database boundary operations are substitutes.
afterEach(() => {
  mongoose.deleteModel(/.+/);
  connection.readyState = 0;
  connection.db = undefined;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
async function initialize(
  options: {
    collectionError?: unknown;
    indexError?: unknown;
    enabled?: string;
    loggerFailure?: boolean;
  } = {},
) {
  vi.resetModules();
  vi.stubEnv("STARTUP_DIAGNOSTICS", options.enabled ?? "1");
  const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
  if (options.loggerFailure)
    log.mockImplementation(() => {
      throw new Error("PRIVATE_LOGGER_FAILURE");
    });
  const operations: string[] = [];
  const collection = {
    createIndex: vi.fn(async () => {
      operations.push("createIndexes");
      if (options.indexError) throw options.indexError;
      return "PRIVATE_INDEX_NAME";
    }),
  };
  connection.db = {
    collection: () => collection,
    createCollection: vi.fn(async () => {
      operations.push("create");
      if (options.collectionError) throw options.collectionError;
      return collection;
    }),
  };
  const { User } = await import("../src/models/user.js");
  // Release model compilation's automatic initialization, without connecting a client.
  connection.onOpen();
  // Wait for automatic init to reach the database substitute before explicitly awaiting init.
  await vi.waitFor(() => expect(operations.length).toBeGreaterThan(0));
  const pending = User.init();
  return { log, operations, pending, collection, User };
}
const events = (log: {
  mock: { calls: unknown[][] };
}): Record<string, unknown>[] =>
  log.mock.calls.map(
    ([line]) => JSON.parse(line as string) as Record<string, unknown>,
  );
it("observes automatic initialization in collection/index order and issues no extra operations", async () => {
  const { log, operations, pending, collection } = await initialize();
  await pending;
  expect(operations).toEqual(["create", "createIndexes"]);
  expect(collection.createIndex).toHaveBeenCalledWith(
    { email: 1 },
    { unique: true },
  );
  expect(events(log)).toEqual([
    {
      event: "startup_diagnostic",
      stage: "user_collection",
      result: "started",
    },
    { event: "startup_diagnostic", stage: "user_collection", result: "ok" },
    {
      event: "startup_diagnostic",
      stage: "user_email_index",
      result: "started",
    },
    { event: "startup_diagnostic", stage: "user_email_index", result: "ok" },
  ]);
});
it("separates collection rejection from index initialization without exposing details", async () => {
  const error = Object.assign(new Error("PRIVATE_URI_PASSWORD_STACK"), {
    code: 8000,
  });
  const { log, operations, pending } = await initialize({
    collectionError: error,
  });
  await expect(pending).rejects.toBe(error);
  expect(operations).toEqual(["create"]);
  expect(events(log)).toEqual([
    {
      event: "startup_diagnostic",
      stage: "user_collection",
      result: "started",
    },
    {
      event: "startup_diagnostic",
      stage: "user_collection",
      result: "failed",
      category: "atlas_rejection_unknown",
      code: 8000,
    },
  ]);
});
it("separates index authorization failure and preserves the error", async () => {
  const error = Object.assign(new Error("PRIVATE_TOKEN_HOST_STACK"), {
    code: 13,
  });
  const { log, operations, pending } = await initialize({ indexError: error });
  await expect(pending).rejects.toBe(error);
  expect(operations).toEqual(["create", "createIndexes"]);
  expect(events(log).at(-1)).toEqual({
    event: "startup_diagnostic",
    stage: "user_email_index",
    result: "failed",
    category: "authorization",
    code: 13,
  });
  expect(JSON.stringify(log.mock.calls)).not.toContain("PRIVATE");
});
it("preserves Mongoose's handled NamespaceExists outcome and still builds the index", async () => {
  const error = Object.assign(new Error("PRIVATE"), {
    name: "MongoServerError",
    code: 48,
  });
  const { log, operations, pending } = await initialize({
    collectionError: error,
  });
  await pending;
  expect(operations).toEqual(["create", "createIndexes"]);
  expect(events(log).map((event) => event.result)).toEqual([
    "started",
    "ok",
    "started",
    "ok",
  ]);
});
it("is silent when disabled while preserving automatic initialization", async () => {
  const { log, operations, pending } = await initialize({ enabled: "0" });
  await pending;
  expect(operations).toEqual(["create", "createIndexes"]);
  expect(log).not.toHaveBeenCalled();
});
it("logger failure cannot reject initialization", async () => {
  const { pending, operations } = await initialize({ loggerFailure: true });
  await expect(pending).resolves.toBeUndefined();
  expect(operations).toEqual(["create", "createIndexes"]);
});

it("repeated init calls do not duplicate event listeners or database operations", async () => {
  const { log, operations, pending, User } = await initialize();
  await pending;
  await User.init();
  await User.init();
  expect(operations).toEqual(["create", "createIndexes"]);
  expect(events(log)).toHaveLength(4);
  expect(User.listenerCount("index-single-start")).toBe(1);
  expect(User.listenerCount("index-single-done")).toBe(1);
});
it("keeps disabled collection failure behavior unchanged", async () => {
  const error = Object.assign(new Error("PRIVATE"), { code: 8000 });
  const { log, operations, pending } = await initialize({
    enabled: "0",
    collectionError: error,
  });
  await expect(pending).rejects.toBe(error);
  expect(operations).toEqual(["create"]);
  expect(log).not.toHaveBeenCalled();
});
