import mongoose from "mongoose";
import { expect, it } from "vitest";
import { Task } from "../src/models/task.js";
const owner = new mongoose.Types.ObjectId();
it("validates a minimal owned task with safe defaults", async () => {
  const task = new Task({ title: " Review API ", owner });
  await expect(task.validate()).resolves.toBeUndefined();
  expect(task.title).toBe("Review API");
  expect(task.description).toBe("");
  expect(task.status).toBe("todo");
  expect(task.owner.equals(owner)).toBe(true);
});
it.each([
  { title: "" },
  { title: "   " },
  { title: "x".repeat(121) },
  { description: "x".repeat(2001) },
  { status: "pending" },
  { status: "in-progress" },
  { status: "unknown" },
  { owner: undefined },
  { owner: "bad-id" },
  { title: undefined },
])("rejects invalid task data %j", async (patch) => {
  await expect(
    new Task({ title: "Task", owner, ...patch }).validate(),
  ).rejects.toThrow();
});
it.each(["todo", "in_progress", "completed"])(
  "accepts status %s",
  async (status) => {
    await expect(
      new Task({ title: "Task", owner, status }).validate(),
    ).resolves.toBeUndefined();
  },
);
it("defines the owner/date/tiebreaker index and timestamps", () => {
  expect(Task.schema.indexes()).toContainEqual([
    { owner: 1, createdAt: -1, _id: -1 },
    {},
  ]);
  expect(Task.schema.options.timestamps).toBe(true);
  expect(Task.schema.path("owner").options.ref).toBe("User");
});
it("rejects unknown model fields", () => {
  expect(() => new Task({ title: "Task", owner, priority: "high" })).toThrow();
});
