import { describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient } from "../api/client";

describe("HTTP client foundation (not connected to the UI)", () => {
  it("uses same-origin cookies, CSRF headers and JSON bodies for mutations", async () => {
    const transport = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { user: { id: "user" } } })),
      );
    const api = createApiClient("/api", transport);
    await api.login({
      email: "demo@example.com",
      password: "made-up-password",
    });
    expect(transport).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-TaskFlow-Request": "1",
        },
        body: JSON.stringify({
          email: "demo@example.com",
          password: "made-up-password",
        }),
      }),
    );
  });
  it("encodes list queries and forwards cancellation without mutation headers", async () => {
    const transport = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ data: { tasks: [] }, meta: { total: 0 } }),
        ),
      );
    const signal = new AbortController().signal;
    await createApiClient("/api", transport).listTasks(
      { q: "[api] & notes", status: "in_progress", page: 2, limit: 6 },
      signal,
    );
    const [path, options] = transport.mock.calls[0];
    const url = new URL(path, "http://localhost");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: "[api] & notes",
      status: "in_progress",
      page: "2",
      limit: "6",
    });
    expect(options.signal).toBe(signal);
    expect(options.headers).toEqual({});
    expect(options.method).toBe("GET");
  });
  it("supports all auth/task boundaries, encoded IDs and empty 204 responses", async () => {
    const transport = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    const api = createApiClient("/api", transport);
    await api.register({
      name: "Demo",
      email: "demo@example.com",
      password: "made-up-password",
    });
    await api.me();
    await api.createTask({ title: "A task", status: "todo" });
    await api.getTask("task/id");
    await api.updateTask("task/id", { status: "completed" });
    await expect(api.deleteTask("task/id")).resolves.toBeUndefined();
    await expect(api.logout()).resolves.toBeUndefined();
    expect(
      transport.mock.calls.map(([path, options]) => [path, options.method]),
    ).toEqual([
      ["/api/auth/register", "POST"],
      ["/api/auth/me", "GET"],
      ["/api/tasks", "POST"],
      ["/api/tasks/task%2Fid", "GET"],
      ["/api/tasks/task%2Fid", "PATCH"],
      ["/api/tasks/task%2Fid", "DELETE"],
      ["/api/auth/logout", "POST"],
    ]);
    expect(transport.mock.calls[5][1].body).toBe("{}");
    expect(transport.mock.calls[6][1].body).toBe("{}");
  });
  it("preserves structured API errors and safely rejects non-JSON responses", async () => {
    const transport = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_ERROR",
            message: "Check fields.",
            fields: { email: ["Invalid email"] },
          },
        }),
        { status: 400 },
      ),
    );
    await expect(createApiClient("/api", transport).me()).rejects.toMatchObject(
      {
        status: 400,
        code: "VALIDATION_ERROR",
        fields: { email: ["Invalid email"] },
      },
    );
    transport.mockResolvedValue(
      new Response("<html>private upstream diagnostic</html>", { status: 502 }),
    );
    await expect(createApiClient("/api", transport).me()).rejects.toMatchObject(
      {
        message: "We couldn’t complete that request. Please try again.",
        status: 502,
      },
    );
    transport.mockResolvedValue(new Response("<html>SPA fallback</html>"));
    await expect(
      createApiClient("/api", transport).me(),
    ).rejects.toBeInstanceOf(ApiError);
  });
  it("rejects cross-origin bases and preserves aborts", async () => {
    expect(() => createApiClient("https://other.example/api")).toThrow(
      "same-origin",
    );
    expect(() => createApiClient("//other.example/api")).toThrow("same-origin");
    const error = new DOMException("Aborted", "AbortError");
    const transport = vi.fn().mockRejectedValue(error);
    await expect(createApiClient("/api", transport).me()).rejects.toBe(error);
  });
});

it("returns a safe actionable error for network failures without exposing transport details", async () => {
  const transport = vi
    .fn()
    .mockRejectedValue(new Error("private transport diagnostic"));
  await expect(createApiClient("/api", transport).me()).rejects.toMatchObject({
    status: 0,
    code: "NETWORK_ERROR",
    message: "We couldn’t reach TaskFlow. Check your connection and try again.",
  });
});
