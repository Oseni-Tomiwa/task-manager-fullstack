import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
const db = vi.hoisted(() => ({
  create: vi.fn(),
  findOne: vi.fn(),
  findById: vi.fn(),
}));
vi.mock("../src/models/user.js", () => ({ User: db }));
const config = {
  NODE_ENV: "test" as const,
  CLIENT_ORIGIN: "http://127.0.0.1:5173",
  JWT_SECRET: randomBytes(32).toString("hex"),
};
const id = "507f1f77bcf86cd799439011",
  password = "TaskFlow test password!";
const record = {
  _id: id,
  name: "Demo User",
  email: "demo@example.com",
  passwordHash: "",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};
const registration = {
  name: " Demo User ",
  email: " DEMO@Example.COM ",
  password,
};
const post = (app: ReturnType<typeof createApp>, path: string) =>
  request(app)
    .post("/api/auth/" + path)
    .set("Origin", config.CLIENT_ORIGIN)
    .set("X-TaskFlow-Request", "1");
function cookieOf(response: request.Response) {
  return String(response.headers["set-cookie"]?.[0]).split(";")[0]!;
}
function signed(payload: object = {}, options: jwt.SignOptions = {}) {
  return jwt.sign(payload, config.JWT_SECRET, {
    algorithm: "HS256",
    subject: id,
    issuer: "taskflow-api",
    audience: "taskflow-web",
    expiresIn: 1800,
    ...options,
  });
}
function noSecrets(response: request.Response) {
  expect(response.body.data.user).toEqual({
    id,
    name: "Demo User",
    email: "demo@example.com",
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
  expect(response.text).not.toMatch(/password|hash|token|__v/i);
}
beforeAll(async () => {
  record.passwordHash = await bcrypt.hash(password, 12);
});
beforeEach(() => {
  vi.clearAllMocks();
  db.create.mockImplementation(async (values) => ({ ...record, ...values }));
  db.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(record) });
  db.findById.mockReturnValue({ select: vi.fn().mockResolvedValue(record) });
});
describe("registration and login", () => {
  it("registers normalized input, hashes with bcrypt cost 12 and returns only public fields", async () => {
    const response = await post(createApp(config), "register").send(
      registration,
    );
    expect(response.status).toBe(201);
    noSecrets(response);
    const saved = db.create.mock.calls[0]![0];
    expect(saved.email).toBe("demo@example.com");
    expect(saved.name).toBe("Demo User");
    expect(saved).not.toHaveProperty("password");
    expect(saved.passwordHash).not.toBe(password);
    expect(bcrypt.getRounds(saved.passwordHash)).toBe(12);
    expect(await bcrypt.compare(password, saved.passwordHash)).toBe(true);
    const cookie = String(response.headers["set-cookie"]?.[0]);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=1800");
    expect(cookie).not.toContain("Secure");
    expect(response.headers["cache-control"]).toBe("no-store");
  });
  it.each([
    { name: "" },
    { name: "x".repeat(81) },
    { email: "invalid" },
    { email: "x".repeat(255) + "@example.com" },
    { password: "short" },
    { password: "x".repeat(73) },
    { password: "😀".repeat(19) },
    { password: "😀".repeat(6) },
    { extra: "unapproved" },
    { name: { $ne: null } },
  ])("rejects invalid registration input %j", async (patch) => {
    const response = await post(createApp(config), "register").send({
      ...registration,
      ...patch,
    });
    expect(response.status).toBe(400);
    expect(db.create).not.toHaveBeenCalled();
    expect(response.headers["set-cookie"]).toBeUndefined();
  });
  it("handles a duplicate-key registration race as a safe 409", async () => {
    db.create.mockRejectedValueOnce({
      code: 11000,
      message: "private mongo detail",
    });
    const response = await post(createApp(config), "register").send(
      registration,
    );
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EMAIL_IN_USE");
    expect(response.text).not.toContain("private");
    expect(response.headers["set-cookie"]).toBeUndefined();
  });
  it("logs in and establishes a session without returning a token", async () => {
    const response = await post(createApp(config), "login").send({
      email: " DEMO@Example.COM ",
      password,
    });
    expect(response.status).toBe(200);
    noSecrets(response);
    expect(db.findOne).toHaveBeenCalledWith({ email: "demo@example.com" });
    expect(response.headers["set-cookie"]).toBeDefined();
  });
  it("gives identical failures for incorrect credentials and an absent user", async () => {
    const app = createApp(config);
    const wrong = await post(app, "login").send({
      email: record.email,
      password: "wrong password value",
    });
    db.findOne.mockReturnValueOnce({ select: vi.fn().mockResolvedValue(null) });
    const absent = await post(app, "login").send({
      email: "absent@example.com",
      password,
    });
    expect(wrong.status).toBe(401);
    expect(absent.status).toBe(401);
    expect(wrong.body).toEqual(absent.body);
    expect(wrong.headers["set-cookie"]).toBeUndefined();
    expect(absent.headers["set-cookie"]).toBeUndefined();
  });
  it("uses a Secure host-only cookie in production", async () => {
    const cfg = {
      ...config,
      NODE_ENV: "production" as const,
      CLIENT_ORIGIN: "https://taskflow.example",
    };
    const response = await request(createApp(cfg))
      .post("/api/auth/login")
      .set("Origin", cfg.CLIENT_ORIGIN)
      .set("X-TaskFlow-Request", "1")
      .send({ email: record.email, password });
    expect(response.status).toBe(200);
    const cookie = String(response.headers["set-cookie"]?.[0]);
    expect(cookie.startsWith("__Host-taskflow=")).toBe(true);
    expect(cookie).toContain("; Secure");
    expect(cookie).not.toContain("Domain=");
  });
});
describe("session protection", () => {
  it("uses the session cookie for a protected safe profile", async () => {
    const app = createApp(config);
    const response = await post(app, "login").send({
      email: record.email,
      password,
    });
    const me = await request(app)
      .get("/api/auth/me")
      .set("Cookie", cookieOf(response));
    expect(me.status).toBe(200);
    noSecrets(me);
    expect(me.headers["cache-control"]).toBe("no-store");
  });
  it("rejects missing cookies and ignores bearer tokens", async () => {
    const response = await request(createApp(config))
      .get("/api/auth/me")
      .set("Authorization", "Bearer " + signed());
    expect(response.status).toBe(401);
    expect(db.findById).not.toHaveBeenCalled();
  });
  it.each([
    "invalid",
    "tampered",
    "expired",
    "wrong-issuer",
    "wrong-audience",
    "wrong-algorithm",
    "invalid-subject",
    "no-expiry",
  ])("rejects %s sessions before querying the database", async (kind) => {
    let token = signed();
    if (kind === "invalid") token = "not-a-jwt";
    if (kind === "tampered") token = token.slice(0, -3) + "abc";
    if (kind === "expired") token = signed({}, { expiresIn: -1 });
    if (kind === "wrong-issuer") token = signed({}, { issuer: "other" });
    if (kind === "wrong-audience") token = signed({}, { audience: "other" });
    if (kind === "wrong-algorithm") token = signed({}, { algorithm: "HS384" });
    if (kind === "invalid-subject")
      token = signed({}, { subject: "not-an-object-id" });
    if (kind === "no-expiry")
      token = jwt.sign({}, config.JWT_SECRET, {
        subject: id,
        issuer: "taskflow-api",
        audience: "taskflow-web",
      });
    const response = await request(createApp(config))
      .get("/api/auth/me")
      .set("Cookie", "taskflow_session=" + token);
    expect(response.status).toBe(401);
    expect(db.findById).not.toHaveBeenCalled();
  });
  it("rejects an otherwise-valid session whose user was deleted", async () => {
    db.findById.mockReturnValueOnce({
      select: vi.fn().mockResolvedValue(null),
    });
    const response = await request(createApp(config))
      .get("/api/auth/me")
      .set("Cookie", "taskflow_session=" + signed());
    expect(response.status).toBe(401);
  });
  it("clears the cookie on logout, including already-expired sessions", async () => {
    const app = createApp(config);
    const agent = request.agent(app);
    await agent
      .post("/api/auth/login")
      .set("Origin", config.CLIENT_ORIGIN)
      .set("X-TaskFlow-Request", "1")
      .send({ email: record.email, password });
    const response = await agent
      .post("/api/auth/logout")
      .set("Origin", config.CLIENT_ORIGIN)
      .set("X-TaskFlow-Request", "1")
      .send({});
    expect(response.status).toBe(204);
    const cookie = String(response.headers["set-cookie"]?.[0]);
    expect(cookie).toContain("taskflow_session=;");
    expect(cookie).toContain("Expires=Thu, 01 Jan 1970");
    expect((await agent.get("/api/auth/me")).status).toBe(401);
    expect((await post(app, "logout").send({})).status).toBe(204);
  });
});
describe("CSRF and abuse prevention", () => {
  it.each(["register", "login", "logout"])(
    "requires exact trusted Origin and custom header on %s",
    async (path) => {
      const app = createApp(config);
      for (const origin of [
        undefined,
        "null",
        "https://evil.example",
        config.CLIENT_ORIGIN + ".evil.example",
      ]) {
        let query = request(app)
          .post("/api/auth/" + path)
          .set("X-TaskFlow-Request", "1");
        if (origin) query = query.set("Origin", origin);
        const response = await query.send(registration);
        expect(response.status).toBe(403);
      }
      expect(
        (
          await request(app)
            .post("/api/auth/" + path)
            .set("Origin", config.CLIENT_ORIGIN)
            .send(registration)
        ).status,
      ).toBe(403);
      expect(db.create).not.toHaveBeenCalled();
      expect(db.findOne).not.toHaveBeenCalled();
    },
  );
  it("rejects simple-form content types", async () => {
    const response = await post(createApp(config), "login")
      .type("form")
      .send({ email: record.email, password });
    expect(response.status).toBe(415);
  });
  it("does not grant credentialed cross-origin access through CORS", async () => {
    const response = await request(createApp(config))
      .options("/api/auth/login")
      .set("Origin", "https://evil.example")
      .set("Access-Control-Request-Method", "POST");
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    expect(
      response.headers["access-control-allow-credentials"],
    ).toBeUndefined();
  });
  it("limits registration and login attempts together and ignores spoofed forwarded IPs", async () => {
    const app = createApp(config);
    for (let i = 0; i < 10; i++) {
      expect(
        (
          await post(app, i % 2 ? "login" : "register")
            .set("X-Forwarded-For", "192.0.2." + (i + 1))
            .send({})
        ).status,
      ).toBe(400);
    }
    const response = await post(app, "login").send({});
    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe("RATE_LIMITED");
    expect(response.headers["retry-after"]).toBeDefined();
  });
});
it("does not cache malformed JSON errors on auth endpoints", async () => {
  const response = await post(createApp(config), "login")
    .set("Content-Type", "application/json")
    .send("{");
  expect(response.status).toBe(400);
  expect(response.headers["cache-control"]).toBe("no-store");
});
it("keeps unexpected database errors generic and returns no session", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  db.findOne.mockReturnValueOnce({
    select: vi.fn().mockRejectedValue(new Error("private database detail")),
  });
  try {
    const response = await post(createApp(config), "login").send({
      email: record.email,
      password,
    });
    expect(response.status).toBe(500);
    expect(response.text).not.toContain("private");
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(log).toHaveBeenCalledWith("Unhandled request error.");
  } finally {
    log.mockRestore();
  }
});
it("clears the production cookie with the matching scope and security attributes", async () => {
  const cfg = {
    ...config,
    NODE_ENV: "production" as const,
    CLIENT_ORIGIN: "https://taskflow.example",
  };
  const response = await request(createApp(cfg))
    .post("/api/auth/logout")
    .set("Origin", cfg.CLIENT_ORIGIN)
    .set("X-TaskFlow-Request", "1")
    .send({});
  expect(response.status).toBe(204);
  const cookie = String(response.headers["set-cookie"]?.[0]);
  expect(cookie).toContain("__Host-taskflow=;");
  expect(cookie).toContain("Path=/");
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("Secure");
  expect(cookie).toContain("SameSite=Lax");
  expect(cookie).not.toContain("Domain=");
});
