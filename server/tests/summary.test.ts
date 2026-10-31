import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import { beforeEach, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

const db = vi.hoisted(() => ({ aggregate: vi.fn() }));
const users = vi.hoisted(() => ({ findById: vi.fn() }));
vi.mock("../src/models/task.js", () => ({
  Task: db,
  TASK_STATUSES: ["todo", "in_progress", "completed"],
}));
vi.mock("../src/models/user.js", () => ({ User: users }));
const config = {
  NODE_ENV: "test" as const,
  CLIENT_ORIGIN: "http://127.0.0.1:5173",
  JWT_SECRET: randomBytes(32).toString("hex"),
};
const owner = new mongoose.Types.ObjectId();
const cookie =
  "taskflow_session=" +
  jwt.sign({}, config.JWT_SECRET, {
    subject: owner.toString(),
    issuer: "taskflow-api",
    audience: "taskflow-web",
    expiresIn: 1800,
  });
beforeEach(() => {
  vi.resetAllMocks();
  users.findById.mockReturnValue({
    select: async () => ({
      _id: owner,
      name: "Summary user",
      email: "summary@example.com",
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  });
  db.aggregate.mockResolvedValue([]);
});
const get = (query = "") =>
  request(createApp(config))
    .get("/api/tasks/summary" + query)
    .set("Cookie", cookie);
it("returns zero counts for an empty owned workspace with no-store", async () => {
  const response = await get();
  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: { summary: { total: 0, todo: 0, in_progress: 0, completed: 0 } },
  });
  expect(response.headers["cache-control"]).toBe("no-store");
});
it("returns global status counts and casts the authenticated owner for aggregation", async () => {
  db.aggregate.mockResolvedValue([
    { _id: "todo", count: 7 },
    { _id: "in_progress", count: 2 },
    { _id: "completed", count: 3 },
  ]);
  const response = await get();
  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: { summary: { total: 12, todo: 7, in_progress: 2, completed: 3 } },
  });
  expect(db.aggregate).toHaveBeenCalledWith([
    { $match: { owner } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
});
it("rejects unauthenticated summary access before database aggregation", async () => {
  expect(
    (await request(createApp(config)).get("/api/tasks/summary")).status,
  ).toBe(401);
  expect(db.aggregate).not.toHaveBeenCalled();
});
it.each(["?status=todo", "?q=private", "?page=2", "?owner=other"])(
  "rejects unsupported summary query %s",
  async (query) => {
    expect((await get(query)).status).toBe(400);
    expect(db.aggregate).not.toHaveBeenCalled();
  },
);
it("uses safe errors for failed aggregation", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  db.aggregate.mockRejectedValue(new Error("private database information"));
  const response = await get();
  expect(response.status).toBe(500);
  expect(JSON.stringify(response.body)).not.toContain("private");
  expect(response.body.error.code).toBe("INTERNAL_ERROR");
  log.mockRestore();
});
