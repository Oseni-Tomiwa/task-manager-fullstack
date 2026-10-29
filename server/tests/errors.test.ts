import express from "express";
import request from "supertest";
import { afterEach, expect, it, vi } from "vitest";
import { errorHandler } from "../src/middleware/errors.js";
import { createApp } from "../src/app.js";

afterEach(() => vi.restoreAllMocks());
it("sanitizes unexpected failures in responses and logs", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const app = express();
  app.get("/fail", () => {
    throw new Error("private-internal-detail");
  });
  app.use(errorHandler);
  const response = await request(app).get("/fail");
  expect(response.status).toBe(500);
  expect(response.body).toEqual({
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
  });
  expect(log).toHaveBeenCalledWith("Unhandled request error.");
  expect(JSON.stringify(log.mock.calls)).not.toContain(
    "private-internal-detail",
  );
});
it("rejects an unsupported JSON charset without exposing parser details", async () => {
  const response = await request(createApp())
    .post("/not-a-route")
    .set("Content-Type", "application/json; charset=iso-8859-1")
    .send("{}");
  expect(response.status).toBe(415);
  expect(response.body.error.code).toBe("UNSUPPORTED_ENCODING");
});
