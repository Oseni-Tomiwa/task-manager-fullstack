import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import { parseEnv } from "node:util";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import {
  connectDatabase,
  disconnectDatabase,
} from "../../src/database/connection.js";
import { User } from "../../src/models/user.js";
import { Task } from "../../src/models/task.js";

// Read only the dedicated file: never fall back to a developer/production URI.
const env = parseEnv(
  readFileSync(new URL("../../.env.integration", import.meta.url), "utf8"),
);
const uri = env.INTEGRATION_MONGODB_URI;
function safeTarget(value: string | undefined): value is string {
  try {
    const url = new URL(value ?? "");
    return (
      url.protocol === "mongodb:" &&
      url.hostname === "127.0.0.1" &&
      url.port === "27018" &&
      url.pathname === "/taskflow_integration_test" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}
if (!safeTarget(uri))
  throw new Error("Integration database safety check failed.");

const run = `phase35-${randomUUID()}`;
const emails = ["alice", "bob", "model"].map(
  (name) => `${run}-${name}@example.com`,
);
const config = {
  NODE_ENV: "test" as const,
  CLIENT_ORIGIN: "http://127.0.0.1:5173",
  JWT_SECRET: randomBytes(32).toString("hex"),
};
const password = "Integration password 123!";
let server: Server | undefined;
let aliceCookie = "";
let bobCookie = "";
let taskId = "";
let aliceId = "";
const client = () => request(server!);
const write = (
  method: "post" | "patch" | "delete",
  path: string,
  cookie = aliceCookie,
) => {
  const http = client();
  return http[method](path)
    .set("Origin", config.CLIENT_ORIGIN)
    .set("X-TaskFlow-Request", "1")
    .set("Cookie", cookie)
    .set("Content-Type", "application/json");
};
const cookieOf = (response: request.Response) =>
  String(response.headers["set-cookie"]?.[0]).split(";")[0]!;
const read = (path: string, cookie = aliceCookie) =>
  client().get(path).set("Cookie", cookie);

beforeAll(async () => {
  await connectDatabase(uri);
  expect(mongoose.connection.name).toBe("taskflow_integration_test");
  expect(await mongoose.connection.db!.admin().ping()).toHaveProperty("ok", 1);
  // Build missing indexes without dropping or reconciling existing indexes.
  await Promise.all([User.init(), Task.init()]);
  server = createApp(config).listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server!.once("listening", resolve);
    server!.once("error", reject);
  });
});
afterAll(async () => {
  try {
    if (server)
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => (error ? reject(error) : resolve())),
      );
  } finally {
    try {
      if (mongoose.connection.readyState === 1) {
        // Exact run-specific emails also find records if an HTTP assertion failed.
        const users = await User.find({ email: { $in: emails } }).select("_id");
        const owners = users.map((user) => user._id);
        await Task.deleteMany({ owner: { $in: owners } });
        await User.deleteMany({ email: { $in: emails } });
        expect(await Task.countDocuments({ owner: { $in: owners } })).toBe(0);
        expect(await User.countDocuments({ email: { $in: emails } })).toBe(0);
      }
    } finally {
      await disconnectDatabase();
      expect(mongoose.connection.readyState).toBe(0);
    }
  }
});

describe.sequential("real MongoDB and loopback HTTP", () => {
  it("connects and exposes the persisted unique email index", async () => {
    expect(mongoose.connection.readyState).toBe(1);
    const indexes = await User.collection.indexes();
    expect(indexes.some((index) => index.key.email === 1 && index.unique)).toBe(
      true,
    );
    const input = {
      name: run,
      email: emails[2],
      passwordHash: "test-only-hash",
    };
    await User.create(input);
    await expect(User.create(input)).rejects.toMatchObject({ code: 11000 });
  });
  it("registers two users with HttpOnly session cookies", async () => {
    for (const [index, name] of ["Alice", "Bob"].entries()) {
      const response = await write("post", "/api/auth/register", "").send({
        name,
        email: emails[index],
        password,
      });
      expect(response.status).toBe(201);
      expect(Object.keys(response.body.data.user).sort()).toEqual([
        "createdAt",
        "email",
        "id",
        "name",
        "updatedAt",
      ]);
      const cookie = String(response.headers["set-cookie"]?.[0]);
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Lax");
      expect(cookie).toContain("Path=/");
      expect(cookie).toContain("Max-Age=1800");
      if (index === 0) {
        aliceCookie = cookieOf(response);
        aliceId = response.body.data.user.id;
      } else bobCookie = cookieOf(response);
    }
  });
  it("persists timestamps and bcrypt hashes while excluding hashes by default and from JSON", async () => {
    const user = await User.findById(aliceId);
    expect(user).not.toBeNull();
    expect(user!.createdAt).toBeInstanceOf(Date);
    expect(user!.updatedAt).toBeInstanceOf(Date);
    expect(user!.passwordHash).toBeUndefined();
    const selected = await User.findById(aliceId).select("+passwordHash");
    expect(await bcrypt.compare(password, selected!.passwordHash)).toBe(true);
    expect(bcrypt.getRounds(selected!.passwordHash)).toBe(12);
    expect(selected!.toJSON()).not.toHaveProperty("passwordHash");
    const changed = await User.findByIdAndUpdate(
      aliceId,
      { name: "Alice updated" },
      { returnDocument: "after" },
    );
    expect(changed!.createdAt).toEqual(user!.createdAt);
    expect(changed!.updatedAt.getTime()).toBeGreaterThan(
      user!.updatedAt.getTime(),
    );
  });
  it("returns 409 for duplicate registration without creating another user", async () => {
    const response = await write("post", "/api/auth/register", "").send({
      name: "Duplicate",
      email: emails[0]!.toUpperCase(),
      password,
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EMAIL_IN_USE");
    expect(await User.countDocuments({ email: emails[0] })).toBe(1);
  });
  it("logs in using persisted credentials, rejects wrong/missing credentials and serves /me", async () => {
    for (const email of [emails[0], `${run}-missing@example.com`]) {
      expect(
        (
          await write("post", "/api/auth/login", "").send({
            email,
            password: "Wrong password 123!",
          })
        ).status,
      ).toBe(401);
    }
    const login = await write("post", "/api/auth/login", "").send({
      email: emails[0],
      password,
    });
    expect(login.status).toBe(200);
    expect(login.body.data.user).not.toHaveProperty("passwordHash");
    aliceCookie = cookieOf(login);
    const me = await read("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.data.user.id).toBe(aliceId);
    expect(me.body.data.user.name).toBe("Alice updated");
    expect(me.body.data.user).not.toHaveProperty("passwordHash");
  });
  it("rejects CSRF failures for auth and task mutations without writes", async () => {
    for (const path of ["/api/auth/logout", "/api/tasks"]) {
      expect(
        (
          await client()
            .post(path)
            .set("Cookie", aliceCookie)
            .send({ title: run })
        ).status,
      ).toBe(403);
      expect(
        (
          await client()
            .post(path)
            .set("Cookie", aliceCookie)
            .set("Origin", "https://evil.example")
            .set("X-TaskFlow-Request", "1")
            .send({ title: run })
        ).status,
      ).toBe(403);
      expect(
        (
          await client()
            .post(path)
            .set("Cookie", aliceCookie)
            .set("Origin", config.CLIENT_ORIGIN)
            .send({ title: run })
        ).status,
      ).toBe(403);
    }
    expect(
      (
        await client()
          .post("/api/tasks")
          .set("Cookie", aliceCookie)
          .set("Origin", config.CLIENT_ORIGIN)
          .set("X-TaskFlow-Request", "1")
          .type("form")
          .send({ title: run })
      ).status,
    ).toBe(415);
    expect(await Task.countDocuments({ owner: aliceId })).toBe(0);
  });
  it("creates and retrieves a task backed by MongoDB", async () => {
    const response = await write("post", "/api/tasks").send({
      title: `${run} Alpha [literal]`,
      description: "persisted detail",
    });
    expect(response.status).toBe(201);
    taskId = response.body.data.task.id;
    expect(response.body.data.task.status).toBe("todo");
    const saved = await Task.findById(taskId);
    expect(saved!.owner.toString()).toBe(aliceId);
    expect(saved!.description).toBe("persisted detail");
    const get = await read(`/api/tasks/${taskId}`);
    expect(get.status).toBe(200);
    expect(get.body.data.task).toEqual(response.body.data.task);
    expect(get.body.data.task).not.toHaveProperty("owner");
  });
  it("preserves records across database disconnect and reconnect", async () => {
    await disconnectDatabase();
    expect(mongoose.connection.readyState).toBe(0);
    await connectDatabase(uri);
    expect(mongoose.connection.readyState).toBe(1);
    expect((await read(`/api/tasks/${taskId}`)).status).toBe(200);
    expect(await Task.countDocuments({ _id: taskId, owner: aliceId })).toBe(1);
  });
  it("updates only supplied task fields and advances timestamps", async () => {
    const before = await Task.findById(taskId);
    const response = await write("patch", `/api/tasks/${taskId}`).send({
      status: "completed",
    });
    expect(response.status).toBe(200);
    const saved = await Task.findById(taskId);
    expect(saved!.status).toBe("completed");
    expect(saved!.title).toBe(before!.title);
    expect(saved!.description).toBe(before!.description);
    expect(saved!.createdAt).toEqual(before!.createdAt);
    expect(saved!.updatedAt.getTime()).toBeGreaterThan(
      before!.updatedAt.getTime(),
    );
  });
  it("searches literal titles case-insensitively and combines status filtering", async () => {
    expect(
      (
        await write("post", "/api/tasks").send({
          title: `${run} Beta`,
          status: "in_progress",
        })
      ).status,
    ).toBe(201);
    const result = await read(
      `/api/tasks?q=${encodeURIComponent("ALPHA [literal]")}&status=completed`,
    );
    expect(result.status).toBe(200);
    expect(
      result.body.data.tasks.map((task: { id: string }) => task.id),
    ).toEqual([taskId]);
    expect(result.body.meta.total).toBe(1);
    const empty = await read("/api/tasks?q=Alpha&status=todo");
    expect(empty.body.data.tasks).toEqual([]);
    expect(empty.body.meta.total).toBe(0);
  });
  it("paginates with stable descending _id ordering when createdAt timestamps tie", async () => {
    const tied = new Date("2020-01-01T00:00:00Z");
    await Task.updateMany(
      { owner: aliceId },
      { $set: { createdAt: tied } },
      { timestamps: false },
    );
    const expected = (
      await Task.find({ owner: aliceId }).sort({ createdAt: -1, _id: -1 })
    ).map((task) => task.id);
    expect(expected).toHaveLength(2);
    expect(expected[0]! > expected[1]!).toBe(true);
    for (let repeat = 0; repeat < 2; repeat++) {
      const first = await read("/api/tasks?page=1&limit=1");
      const second = await read("/api/tasks?page=2&limit=1");
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect([
        first.body.data.tasks[0].id,
        second.body.data.tasks[0].id,
      ]).toEqual(expected);
      expect(first.body.meta).toEqual({
        page: 1,
        limit: 1,
        total: 2,
        totalPages: 2,
      });
    }
    expect((await read("/api/tasks?page=3&limit=1")).body.data.tasks).toEqual(
      [],
    );
  });
  it("isolates cross-user lists, reads, updates and deletes", async () => {
    const bobTask = await write("post", "/api/tasks", bobCookie).send({
      title: `${run} Bob private`,
    });
    expect(bobTask.status).toBe(201);
    const list = await read("/api/tasks", bobCookie);
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(1);
    expect(list.body.data.tasks.map((task: { id: string }) => task.id)).toEqual(
      [bobTask.body.data.task.id],
    );
    expect((await read(`/api/tasks/${bobTask.body.data.task.id}`)).status).toBe(
      404,
    );
    expect((await read(`/api/tasks/${taskId}`, bobCookie)).status).toBe(404);
    expect(
      (
        await write("patch", `/api/tasks/${taskId}`, bobCookie).send({
          title: "stolen",
        })
      ).status,
    ).toBe(404);
    expect(
      (await write("delete", `/api/tasks/${taskId}`, bobCookie).send({}))
        .status,
    ).toBe(404);
    expect((await Task.findById(taskId))!.title).toContain(run);
    expect(
      (await read(`/api/tasks?q=${encodeURIComponent("Alpha")}`, bobCookie))
        .body.meta.total,
    ).toBe(0);
  });
  it("rejects invalid bodies, IDs, queries and unauthorized access without writes", async () => {
    const before = await Task.countDocuments({ owner: aliceId });
    for (const body of [
      { title: "" },
      { title: "x", owner: aliceId },
      { title: "x", status: "invalid" },
    ]) {
      expect((await write("post", "/api/tasks").send(body)).status).toBe(400);
    }
    for (const body of [{}, { owner: aliceId }, { status: "invalid" }]) {
      expect(
        (await write("patch", `/api/tasks/${taskId}`).send(body)).status,
      ).toBe(400);
    }
    for (const path of [
      "/api/tasks/bad-id",
      "/api/tasks?page=0",
      "/api/tasks?limit=101",
      "/api/tasks?sort=title",
      "/api/tasks?status=invalid",
    ]) {
      expect((await read(path)).status).toBe(400);
    }
    expect(
      (await write("post", "/api/auth/register", "").send({ email: "invalid" }))
        .status,
    ).toBe(400);
    for (const path of ["/api/auth/me", "/api/tasks", `/api/tasks/${taskId}`]) {
      expect((await client().get(path)).status).toBe(401);
      expect((await read(path, "taskflow_session=invalid")).status).toBe(401);
    }
    for (const method of ["post", "patch", "delete"] as const) {
      expect(
        (
          await write(
            method,
            method === "post" ? "/api/tasks" : `/api/tasks/${taskId}`,
            "",
          ).send({ title: run })
        ).status,
      ).toBe(401);
    }
    expect(await Task.countDocuments({ owner: aliceId })).toBe(before);
  });
  it("deletes persisted tasks and reports subsequent reads/deletes as missing", async () => {
    expect(
      (await write("delete", `/api/tasks/${taskId}`).send({})).status,
    ).toBe(204);
    expect(await Task.findById(taskId)).toBeNull();
    expect((await read(`/api/tasks/${taskId}`)).status).toBe(404);
    expect(
      (await write("delete", `/api/tasks/${taskId}`).send({})).status,
    ).toBe(404);
  });
  it("logs out by expiring the HttpOnly cookie and rejects requests without it", async () => {
    const response = await write("post", "/api/auth/logout").send({});
    expect(response.status).toBe(204);
    const cookie = String(response.headers["set-cookie"]?.[0]);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Expires=Thu, 01 Jan 1970");
    expect((await read("/api/auth/me", cookieOf(response))).status).toBe(401);
  });
});
