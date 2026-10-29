import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

describe("HTTP foundation", () => {
  it("returns the exact public health response without authentication", async () => {
    const response = await request(createApp()).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/json/);
    expect(response.body).toEqual({ status: "ok" });
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
  it("returns a JSON 404 for unknown routes", async () => {
    const response = await request(createApp()).get("/not-a-route");
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: "NOT_FOUND", message: "Route not found." },
    });
  });
  it("handles malformed JSON without exposing the payload or parser error", async () => {
    const response = await request(createApp())
      .post("/not-a-route")
      .set("Content-Type", "application/json")
      .send('{"secret":');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "INVALID_JSON",
        message: "Request body must be valid JSON.",
      },
    });
    expect(response.text).not.toContain("secret");
  });
  it("limits JSON request bodies to 16 KiB", async () => {
    const response = await request(createApp())
      .post("/not-a-route")
      .send({ value: "x".repeat(17 * 1024) });
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });
  it("does not treat well-formed JSON as malformed on an unknown route", async () => {
    const response = await request(createApp())
      .post("/not-a-route")
      .send({ value: "valid" });
    expect(response.status).toBe(404);
  });
});
