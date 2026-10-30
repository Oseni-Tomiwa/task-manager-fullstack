import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
const db = vi.hoisted(() => ({
  create: vi.fn(),
  find: vi.fn(),
  countDocuments: vi.fn(),
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  findOneAndDelete: vi.fn(),
}));
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
const a = "507f1f77bcf86cd799439011",
  b = "507f1f77bcf86cd799439012";
const id = (n: number) =>
  new mongoose.Types.ObjectId(n.toString(16).padStart(24, "0"));
type Row = {
  _id: mongoose.Types.ObjectId;
  owner: string;
  title: string;
  description: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};
type Filter = {
  owner: string;
  _id?: string;
  status?: string;
  title?: { $regex: string; $options: string };
};
let rows: Row[];
let app: ReturnType<typeof createApp>;
const match = (row: Row, f: Filter) =>
  row.owner === f.owner &&
  (!f._id || row._id.toString() === f._id) &&
  (!f.status || row.status === f.status) &&
  (!f.title || new RegExp(f.title.$regex, f.title.$options).test(row.title));
function api(
  method: "get" | "post" | "patch" | "delete",
  path = "",
  owner = a,
) {
  const token = jwt.sign({}, config.JWT_SECRET, {
    subject: owner,
    issuer: "taskflow-api",
    audience: "taskflow-web",
    expiresIn: 1800,
    algorithm: "HS256",
  });
  const client = request(app);
  return client[method]("/api/tasks" + path)
    .set("Cookie", "taskflow_session=" + token)
    .set("Origin", config.CLIENT_ORIGIN)
    .set("X-TaskFlow-Request", "1");
}
beforeEach(() => {
  vi.clearAllMocks();
  app = createApp(config);
  rows = [
    {
      _id: id(1),
      owner: a,
      title: "Review API",
      description: "Own task",
      status: "todo",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    },
    {
      _id: id(2),
      owner: b,
      title: "Private other task",
      description: "Foreign task",
      status: "completed",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    },
  ];
  users.findById.mockImplementation((owner) => ({
    select: async () => ({
      _id: new mongoose.Types.ObjectId(owner),
      name: "Demo",
      email: "demo@example.com",
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  }));
  db.create.mockImplementation(async (values) => {
    const row = {
      ...values,
      _id: id(rows.length + 1),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    rows.push(row);
    return row;
  });
  db.findOne.mockImplementation(
    async (filter) => rows.find((row) => match(row, filter)) ?? null,
  );
  db.countDocuments.mockImplementation(
    async (filter) => rows.filter((row) => match(row, filter)).length,
  );
  db.find.mockImplementation((filter) => {
    let offset = 0;
    const chain = {
      sort: vi.fn(),
      skip: vi.fn(),
      limit: async (value: number) =>
        rows
          .filter((row) => match(row, filter))
          .sort(
            (x, y) =>
              y.createdAt.getTime() - x.createdAt.getTime() ||
              y._id.toString().localeCompare(x._id.toString()),
          )
          .slice(offset, offset + value),
    };
    chain.sort.mockReturnValue(chain);
    chain.skip.mockImplementation((value: number) => {
      offset = value;
      return chain;
    });
    return chain;
  });
  db.findOneAndUpdate.mockImplementation(async (filter, update) => {
    const row = rows.find((row) => match(row, filter));
    if (!row) return null;
    Object.assign(row, update.$set);
    return row;
  });
  db.findOneAndDelete.mockImplementation(async (filter) => {
    const index = rows.findIndex((row) => match(row, filter));
    return index < 0 ? null : rows.splice(index, 1)[0];
  });
});
afterEach(() => vi.restoreAllMocks());
it.each([
  ["get", ""],
  ["post", ""],
  ["get", "/" + id(1)],
  ["patch", "/" + id(1)],
  ["delete", "/" + id(1)],
] as const)("requires authentication for %s %s", async (method, path) => {
  const client = request(app);
  const response = await client[method]("/api/tasks" + path).send({});
  expect(response.status).toBe(401);
  expect(db.find).not.toHaveBeenCalled();
  expect(db.create).not.toHaveBeenCalled();
});
it("creates only a server-owned task and returns an explicit public DTO", async () => {
  const response = await api("post").send({ title: " New task " });
  expect(response.status).toBe(201);
  expect(db.create).toHaveBeenCalledWith({
    title: "New task",
    description: "",
    status: "todo",
    owner: a,
  });
  expect(response.body.data.task).toMatchObject({
    title: "New task",
    description: "",
    status: "todo",
  });
  expect(Object.keys(response.body.data.task).sort()).toEqual(
    ["id", "title", "description", "status", "createdAt", "updatedAt"].sort(),
  );
  expect(response.headers["cache-control"]).toBe("no-store");
});
it.each([
  { title: "" },
  { title: "  " },
  { title: "x".repeat(121) },
  { title: { $ne: null } },
  { description: "x".repeat(2001) },
  { status: "pending" },
  { status: "in-progress" },
  { owner: b },
  { id: id(2).toString() },
  { createdAt: "2020-01-01" },
  { priority: "high" },
  { $set: { owner: b } },
])("rejects invalid creation or field injection %j", async (patch) => {
  const response = await api("post").send({ title: "Task", ...patch });
  expect(response.status).toBe(400);
  expect(db.create).not.toHaveBeenCalled();
});
it("lists only the current owner with metadata, filter count and stable sorting", async () => {
  const response = await api("get");
  expect(response.status).toBe(200);
  expect(response.body.data.tasks.map((t: { id: string }) => t.id)).toEqual([
    id(1).toString(),
  ]);
  expect(response.body.meta).toEqual({
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
  });
  expect(db.find).toHaveBeenCalledWith({ owner: a });
  expect(db.countDocuments).toHaveBeenCalledWith({ owner: a });
  const query = db.find.mock.results[0]!.value;
  expect(query.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
  expect(query.skip).toHaveBeenCalledWith(0);
});
it("retrieves an owned task without exposing owner or user details", async () => {
  const response = await api("get", "/" + id(1));
  expect(response.status).toBe(200);
  expect(response.body.data.task.id).toBe(id(1).toString());
  expect(response.body.data.task).not.toHaveProperty("owner");
  expect(db.findOne).toHaveBeenCalledWith({ _id: id(1).toString(), owner: a });
});
it.each(["get", "patch", "delete"] as const)(
  "isolates cross-user %s and uses the same 404 for absent tasks",
  async (method) => {
    let foreign = api(method, "/" + id(2));
    let absent = api(method, "/" + id(99));
    if (method === "patch") {
      foreign = foreign.send({ title: "Hacked" });
      absent = absent.send({ title: "Hacked" });
    }
    if (method === "delete") {
      foreign = foreign.send({});
      absent = absent.send({});
    }
    const x = await foreign,
      y = await absent;
    expect(x.status).toBe(404);
    expect(y.status).toBe(404);
    expect(x.body).toEqual(y.body);
    expect(rows.find((r) => r.owner === b)?.title).toBe("Private other task");
  },
);
it("returns the second user only their own task", async () => {
  const response = await api("get", "", b);
  expect(response.body.data.tasks.map((t: { id: string }) => t.id)).toEqual([
    id(2).toString(),
  ]);
  expect(db.find).toHaveBeenCalledWith({ owner: b });
});
it("updates only validated fields with owner scope and database validators enabled", async () => {
  const response = await api("patch", "/" + id(1)).send({ title: " Revised " });
  expect(response.status).toBe(200);
  expect(response.body.data.task.title).toBe("Revised");
  expect(response.body.data.task.description).toBe("Own task");
  expect(db.findOneAndUpdate).toHaveBeenCalledWith(
    { _id: id(1).toString(), owner: a },
    { $set: { title: "Revised" } },
    { returnDocument: "after", runValidators: true },
  );
});
it.each(["in_progress", "completed", "todo"] as const)(
  "supports status transition to %s",
  async (status) => {
    const response = await api("patch", "/" + id(1)).send({ status });
    expect(response.status).toBe(200);
    expect(response.body.data.task.status).toBe(status);
  },
);
it("deletes an owned task with no response body", async () => {
  const response = await api("delete", "/" + id(1)).send({});
  expect(response.status).toBe(204);
  expect(response.text).toBe("");
  expect(db.findOneAndDelete).toHaveBeenCalledWith({
    _id: id(1).toString(),
    owner: a,
  });
  expect((await api("get", "/" + id(1))).status).toBe(404);
});
it.each(["get", "patch", "delete"] as const)(
  "rejects malformed IDs on %s without task queries",
  async (method) => {
    const query = api(method, "/not-an-object-id");
    if (method === "patch") query.send({ title: "Task" });
    if (method === "delete") query.send({});
    expect((await query).status).toBe(400);
    expect(db.findOne).not.toHaveBeenCalled();
    expect(db.findOneAndUpdate).not.toHaveBeenCalled();
    expect(db.findOneAndDelete).not.toHaveBeenCalled();
  },
);
it.each([
  {},
  { owner: b },
  { status: "pending" },
  { title: " " },
  { $unset: { owner: 1 } },
  { updatedAt: "2020-01-01" },
])("rejects unsafe or empty updates %j", async (body) => {
  const response = await api("patch", "/" + id(1)).send(body);
  expect(response.status).toBe(400);
  expect(db.findOneAndUpdate).not.toHaveBeenCalled();
});
it("combines literal case-insensitive title search and status without regex injection", async () => {
  rows.push({
    ...rows[0]!,
    _id: id(3),
    title: "Review [API].*",
    status: "completed",
  });
  const response = await api(
    "get",
    "?q=" + encodeURIComponent("[api].*") + "&status=completed",
  );
  expect(response.status).toBe(200);
  expect(response.body.data.tasks.map((t: { id: string }) => t.id)).toEqual([
    id(3).toString(),
  ]);
  expect(response.body.meta.total).toBe(1);
  expect(db.find.mock.calls[0]![0].owner).toBe(a);
});
it("paginates deterministically when creation timestamps tie", async () => {
  rows.push({ ...rows[0]!, _id: id(3) }, { ...rows[0]!, _id: id(4) });
  const first = await api("get", "?page=1&limit=2"),
    second = await api("get", "?page=2&limit=2");
  expect(first.body.data.tasks.map((t: { id: string }) => t.id)).toEqual([
    id(4).toString(),
    id(3).toString(),
  ]);
  expect(second.body.data.tasks.map((t: { id: string }) => t.id)).toEqual([
    id(1).toString(),
  ]);
  expect(second.body.meta).toEqual({
    page: 2,
    limit: 2,
    total: 3,
    totalPages: 2,
  });
});
it("returns coherent empty and out-of-range pages", async () => {
  const none = await api("get", "?q=none");
  expect(none.body).toEqual({
    data: { tasks: [] },
    meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
  });
  const beyond = await api("get", "?page=2");
  expect(beyond.body.data.tasks).toEqual([]);
  expect(beyond.body.meta.total).toBe(1);
});
it.each([
  "page=0",
  "page=-1",
  "page=1.5",
  "page=abc",
  "page=10001",
  "limit=0",
  "limit=101",
  "limit=1e2",
  "status=pending",
  "owner=" + b,
  "status[$ne]=todo",
  "page=1&page=2",
  "q=" + "x".repeat(121),
])("rejects invalid query %s", async (query) => {
  const response = await api("get", "?" + query);
  expect(response.status).toBe(400);
  expect(db.find).not.toHaveBeenCalled();
  expect(db.countDocuments).not.toHaveBeenCalled();
});
it.each(["post", "patch", "delete"] as const)(
  "requires CSRF protection for task %s",
  async (method) => {
    const path = method === "post" ? "" : "/" + id(1);
    const cookie =
      "taskflow_session=" +
      jwt.sign({}, config.JWT_SECRET, {
        subject: a,
        issuer: "taskflow-api",
        audience: "taskflow-web",
        expiresIn: 1800,
      });
    const client = request(app);
    const response = await client[method]("/api/tasks" + path)
      .set("Cookie", cookie)
      .set("Origin", "https://evil.example")
      .set("X-TaskFlow-Request", "1")
      .send({ title: "Task" });
    expect(response.status).toBe(403);
    expect(db.create).not.toHaveBeenCalled();
    expect(db.findOneAndUpdate).not.toHaveBeenCalled();
    expect(db.findOneAndDelete).not.toHaveBeenCalled();
  },
);
it("requires JSON for task mutations", async () => {
  expect((await api("post").type("form").send({ title: "Task" })).status).toBe(
    415,
  );
});
it.each([
  "create",
  "find",
  "countDocuments",
  "findOne",
  "findOneAndUpdate",
  "findOneAndDelete",
] as const)("returns a generic database error for %s", async (method) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  if (method === "find")
    db.find.mockImplementationOnce(() => {
      throw new Error("private mongo detail");
    });
  else db[method].mockRejectedValueOnce(new Error("private mongo detail"));
  const response = await (method === "create"
    ? api("post").send({ title: "Task" })
    : method === "findOne"
      ? api("get", "/" + id(1))
      : method === "findOneAndUpdate"
        ? api("patch", "/" + id(1)).send({ title: "Task" })
        : method === "findOneAndDelete"
          ? api("delete", "/" + id(1)).send({})
          : api("get"));
  expect(response.status).toBe(500);
  expect(response.body.error.code).toBe("INTERNAL_ERROR");
  expect(response.text).not.toContain("private");
});
it("marks a completed task incomplete without changing its other fields", async () => {
  const completed = await api("patch", "/" + id(1)).send({
    status: "completed",
  });
  expect(completed.body.data.task.status).toBe("completed");
  const incomplete = await api("patch", "/" + id(1)).send({ status: "todo" });
  expect(incomplete.body.data.task).toMatchObject({
    title: "Review API",
    description: "Own task",
    status: "todo",
  });
});
it("does not cache task parser errors", async () => {
  const response = await api("post")
    .set("Content-Type", "application/json")
    .send("{");
  expect(response.status).toBe(400);
  expect(response.headers["cache-control"]).toBe("no-store");
  expect(db.create).not.toHaveBeenCalled();
});
