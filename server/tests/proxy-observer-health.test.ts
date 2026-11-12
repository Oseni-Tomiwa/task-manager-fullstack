import request from "supertest";
import { afterEach, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it("preserves health for missing, invalid and valid gates without reflecting diagnostics", async () => {
  vi.stubEnv("PROXY_OBSERVER_ENABLED", "1");
  vi.stubEnv("PROXY_OBSERVER_SECRET", "ab".repeat(32));
  vi.stubEnv(
    "PROXY_OBSERVER_EXPIRES_AT",
    new Date(Date.now() + 10000).toISOString(),
  );
  const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
  const app = createApp();
  for (const gate of [undefined, "wrong", "ab".repeat(32)]) {
    const req = request(app)
      .get("/api/health")
      .set("X-TaskFlow-Observer-Probe", "a_direct_base");
    if (gate) req.set("X-TaskFlow-Observer-Key", gate);
    const response = await req;
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(
      Object.keys(response.headers).some((key) => key.includes("observer")),
    ).toBe(false);
  }
  expect(log).toHaveBeenCalledTimes(1);
  expect(app.get("trust proxy")).toBe(false);
});
it("does not add a public diagnostic route or change health on logger failure", async () => {
  vi.stubEnv("PROXY_OBSERVER_ENABLED", "1");
  vi.stubEnv("PROXY_OBSERVER_SECRET", "ab".repeat(32));
  vi.stubEnv(
    "PROXY_OBSERVER_EXPIRES_AT",
    new Date(Date.now() + 10000).toISOString(),
  );
  const log = vi.spyOn(console, "info").mockImplementation(() => {
    throw new Error("PRIVATE_LOGGER_EXCEPTION");
  });
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const app = createApp();
  const response = await request(app)
    .get("/api/health")
    .set("X-TaskFlow-Observer-Probe", "a_direct_base")
    .set("X-TaskFlow-Observer-Key", "ab".repeat(32));
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ status: "ok" });
  expect((await request(app).get("/api/proxy-observer")).status).toBe(404);
  expect(log).toHaveBeenCalledTimes(1);
  expect(error).not.toHaveBeenCalled();
});
it("is silent by default even when a client sends diagnostic headers", async () => {
  vi.stubEnv("PROXY_OBSERVER_ENABLED", undefined);
  const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
  const response = await request(createApp())
    .get("/api/health")
    .set("X-TaskFlow-Observer-Probe", "a_direct_base")
    .set("X-TaskFlow-Observer-Key", "ab".repeat(32));
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ status: "ok" });
  expect(log).not.toHaveBeenCalled();
});
