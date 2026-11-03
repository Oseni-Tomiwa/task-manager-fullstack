import { afterEach, expect, it, vi } from "vitest";
const deps = vi.hoisted(() => ({ create: vi.fn(), start: vi.fn() }));
vi.mock("../src/config/env.js", () => ({
  parseStartupEnv: () => ({ HOST: "127.0.0.1", PORT: 3000 }),
}));
vi.mock("../src/config/auth.js", () => ({ parseAuthEnv: () => ({}) }));
vi.mock("../src/app.js", () => ({ createApp: deps.create }));
vi.mock("../src/start.js", () => ({ startServer: deps.start }));
afterEach(() => {
  process.exitCode = undefined;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
it("instruments app construction without logging its thrown details", async () => {
  vi.resetModules();
  vi.stubEnv("STARTUP_DIAGNOSTICS", "1");
  const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  deps.create.mockImplementation(() => {
    throw new Error("PRIVATE_TOKEN_URI_STACK");
  });
  await import("../src/index.js");
  expect(info.mock.calls).toEqual([
    [
      JSON.stringify({
        event: "startup_diagnostic",
        stage: "app",
        result: "failed",
        category: "unknown",
      }),
    ],
  ]);
  expect(error.mock.calls).toEqual([
    ["Server startup failed. Check database connectivity and configuration."],
  ]);
  expect(deps.start).not.toHaveBeenCalled();
  expect(process.exitCode).toBe(1);
});
