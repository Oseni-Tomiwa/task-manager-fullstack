import { afterEach, beforeEach, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
const deps = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  init: vi.fn(),
}));
vi.mock("../src/database/connection.js", () => ({
  connectDatabase: deps.connect,
  disconnectDatabase: deps.disconnect,
}));
vi.mock("../src/models/user.js", () => ({ User: { init: deps.init } }));
import { startServer } from "../src/start.js";
const env = {
  NODE_ENV: "test" as const,
  HOST: "127.0.0.1",
  PORT: 0,
  MONGODB_URI: "mongodb://example.invalid/test",
};
let stop: undefined | (() => Promise<void>);
beforeEach(() => {
  vi.clearAllMocks();
  deps.connect.mockResolvedValue(undefined);
  deps.disconnect.mockResolvedValue(undefined);
  deps.init.mockResolvedValue(undefined);
});
afterEach(async () => {
  await stop?.();
  stop = undefined;
  vi.restoreAllMocks();
});
it("waits for database and unique index initialization before listening", async () => {
  let connected!: () => void;
  let indexed!: () => void;
  deps.connect.mockImplementation(
    () =>
      new Promise<void>((done) => {
        connected = done;
      }),
  );
  deps.init.mockImplementation(
    () =>
      new Promise<void>((done) => {
        indexed = done;
      }),
  );
  const app = createApp();
  const listen = vi.spyOn(app, "listen");
  const pending = startServer(env, app);
  expect(listen).not.toHaveBeenCalled();
  connected();
  await vi.waitFor(() => expect(deps.init).toHaveBeenCalledTimes(1));
  expect(listen).not.toHaveBeenCalled();
  indexed();
  const runtime = await pending;
  expect(runtime).toBeDefined();
  stop = runtime!.shutdown;
  expect((await request(runtime!.server).get("/api/health")).body).toEqual({
    status: "ok",
  });
  await Promise.all([stop(), stop()]);
  expect(deps.disconnect).toHaveBeenCalledTimes(1);
});
it.each(["connect", "init"] as const)(
  "cleans up failed %s startup without leaking driver details",
  async (stage) => {
    deps[stage].mockRejectedValueOnce(new Error("private database details"));
    const app = createApp();
    const listen = vi.spyOn(app, "listen");
    await expect(startServer(env, app)).rejects.toThrow(
      /^Server startup failed\.$/,
    );
    expect(listen).not.toHaveBeenCalled();
    expect(deps.disconnect).toHaveBeenCalledTimes(1);
  },
);
it("closes the database when binding HTTP fails", async () => {
  const first = await startServer(env);
  stop = first!.shutdown;
  const address = first!.server.address();
  if (!address || typeof address === "string")
    throw new Error("No server address");
  await expect(startServer({ ...env, PORT: address.port })).rejects.toThrow(
    /^Server startup failed\.$/,
  );
  expect(deps.disconnect).toHaveBeenCalledTimes(1);
});
it("still releases the database when HTTP cleanup reports an error", async () => {
  const runtime = (await startServer(env))!;
  const server = runtime.server;
  const close = vi.spyOn(server, "close").mockImplementation((callback) => {
    callback?.(new Error("private cleanup error"));
    return server;
  });
  try {
    await expect(runtime.shutdown()).rejects.toThrow("HTTP cleanup failed.");
    expect(deps.disconnect).toHaveBeenCalledTimes(1);
  } finally {
    close.mockRestore();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
it("removes its signal handlers after shutdown", async () => {
  const before = process.listenerCount("SIGTERM");
  const runtime = (await startServer(env))!;
  stop = runtime.shutdown;
  expect(process.listenerCount("SIGTERM")).toBe(before + 1);
  await stop();
  expect(process.listenerCount("SIGTERM")).toBe(before);
});
it("does not start HTTP after shutdown is requested during database initialization", async () => {
  let finish!: () => void;
  deps.connect.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const app = createApp();
  const listen = vi.spyOn(app, "listen");
  const pending = startServer(env, app);
  const handler = process.listeners("SIGTERM").at(-1)!;
  handler("SIGTERM");
  finish();
  await expect(pending).resolves.toBeUndefined();
  expect(listen).not.toHaveBeenCalled();
  expect(deps.disconnect).toHaveBeenCalledTimes(1);
});
