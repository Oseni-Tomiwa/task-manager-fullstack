import { beforeEach, expect, it, vi } from "vitest";
const driver = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  connection: { readyState: 0 },
}));
vi.mock("mongoose", () => ({ default: driver }));
const load = () => import("../src/database/connection.js");
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  driver.connection.readyState = 0;
  driver.connect.mockResolvedValue(undefined);
  driver.disconnect.mockResolvedValue(undefined);
});
it("shares concurrent initialization and skips an already-connected database", async () => {
  const db = await load();
  let resolve!: () => void;
  driver.connect.mockImplementation(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  const first = db.connectDatabase("mongodb://example.invalid/test");
  const second = db.connectDatabase("mongodb://example.invalid/test");
  expect(driver.connect).toHaveBeenCalledTimes(1);
  resolve();
  await Promise.all([first, second]);
  driver.connection.readyState = 1;
  await db.connectDatabase("mongodb://example.invalid/test");
  expect(driver.connect).toHaveBeenCalledTimes(1);
  expect(driver.connect).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      maxPoolSize: 10,
    }),
  );
});
it("sanitizes connection errors, cleans resources and permits a retry", async () => {
  const db = await load();
  driver.connect.mockRejectedValueOnce(
    new Error("credential-bearing driver error"),
  );
  await expect(
    db.connectDatabase("mongodb://example.invalid/test"),
  ).rejects.toThrow(/^Database connection failed\.$/);
  expect(driver.disconnect).toHaveBeenCalledTimes(1);
  await expect(
    db.connectDatabase("mongodb://example.invalid/test"),
  ).resolves.toBeUndefined();
  expect(driver.connect).toHaveBeenCalledTimes(2);
});
it("shares cleanup calls and waits for initialization before closing", async () => {
  const db = await load();
  let resolve!: () => void;
  driver.connect.mockImplementation(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  const open = db.connectDatabase("mongodb://example.invalid/test");
  const close1 = db.disconnectDatabase();
  const close2 = db.disconnectDatabase();
  expect(driver.disconnect).not.toHaveBeenCalled();
  resolve();
  await Promise.all([open, close1, close2]);
  expect(driver.disconnect).toHaveBeenCalledTimes(1);
});
it("sanitizes cleanup failures", async () => {
  const db = await load();
  driver.disconnect.mockRejectedValueOnce(new Error("private detail"));
  await expect(db.disconnectDatabase()).rejects.toThrow(
    /^Database cleanup failed\.$/,
  );
});
