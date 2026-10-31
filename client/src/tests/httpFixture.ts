import { vi } from "vitest";
import type { Task, User } from "../api/contracts";
export const testUser: User = {
  id: "507f1f77bcf86cd799439011",
  name: "Tomiwa",
  email: "demo@taskflow.app",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
export const failure = (status = 500, message = "Please try again.") =>
  json(
    {
      error: {
        code: status === 401 ? "UNAUTHENTICATED" : "REQUEST_FAILED",
        message,
      },
    },
    status,
  );
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
export function httpFixture() {
  const titles = [
    "Map out the TaskFlow user journey",
    "Design the authentication screens",
    "Review dashboard accessibility",
    "Write the project documentation",
    "Polish the mobile task experience",
    "Review the API architecture",
    "Prepare prototype walkthrough",
    "Check form validation states",
    "Test search and status filters",
    "Review keyboard navigation",
    "Document deployment decisions",
    "Prepare the internship submission",
  ];
  const state = {
    user: null as User | null,
    tasks: titles.map((title, i): Task => ({
      id: (i + 1).toString(16).padStart(24, "0"),
      title,
      description: "Task context",
      status: (["in_progress", "todo", "completed"] as const)[i % 3],
      createdAt: new Date(Date.UTC(2026, 9, 29 - i)).toISOString(),
      updatedAt: "2026-10-31T00:00:00.000Z",
    })),
    override: undefined as
      | undefined
      | ((
          path: string,
          init: RequestInit,
        ) => Response | Promise<Response> | undefined),
  };
  const transport = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input, init = {}) => {
      const path = String(input);
      const custom = state.override?.(path, init);
      if (custom) return custom;
      const url = new URL(path, "http://localhost");
      const method = init.method ?? "GET";
      const body = init.body ? JSON.parse(String(init.body)) : {};
      if (url.pathname === "/api/auth/me")
        return state.user ? json({ data: { user: state.user } }) : failure(401);
      if (url.pathname === "/api/auth/login") {
        if (
          body.email !== testUser.email ||
          body.password !== "TaskflowDemo!2026"
        )
          return failure(401, "Email or password is incorrect.");
        state.user = testUser;
        return json({ data: { user: testUser } });
      }
      if (url.pathname === "/api/auth/register") {
        state.user = { ...testUser, name: body.name, email: body.email };
        return json({ data: { user: state.user } }, 201);
      }
      if (url.pathname === "/api/auth/logout") {
        state.user = null;
        return new Response(null, { status: 204 });
      }
      if (!state.user) return failure(401);
      if (url.pathname === "/api/tasks/summary")
        return json({
          data: {
            summary: {
              total: state.tasks.length,
              todo: state.tasks.filter((t) => t.status === "todo").length,
              in_progress: state.tasks.filter((t) => t.status === "in_progress")
                .length,
              completed: state.tasks.filter((t) => t.status === "completed")
                .length,
            },
          },
        });
      if (url.pathname === "/api/tasks" && method === "GET") {
        const q = url.searchParams.get("q")?.toLowerCase() ?? "";
        const status = url.searchParams.get("status");
        const page = Number(url.searchParams.get("page") ?? 1),
          limit = Number(url.searchParams.get("limit") ?? 20);
        const tasks = state.tasks.filter(
          (t) =>
            t.title.toLowerCase().includes(q) &&
            (!status || t.status === status),
        );
        return json({
          data: { tasks: tasks.slice((page - 1) * limit, page * limit) },
          meta: {
            page,
            limit,
            total: tasks.length,
            totalPages: Math.ceil(tasks.length / limit),
          },
        });
      }
      if (url.pathname === "/api/tasks" && method === "POST") {
        const task = {
          ...body,
          id: "new-task",
          createdAt: "2026-10-31T00:00:00.000Z",
          updatedAt: "2026-10-31T00:00:00.000Z",
        };
        state.tasks.unshift(task);
        return json({ data: { task } }, 201);
      }
      const id = url.pathname.split("/").at(-1);
      const task = state.tasks.find((t) => t.id === id);
      if (task && method === "PATCH") {
        Object.assign(task, body);
        return json({ data: { task } });
      }
      if (task && method === "DELETE") {
        state.tasks = state.tasks.filter((t) => t.id !== id);
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unhandled test request ${method} ${path}`);
    });
  return { state, transport };
}
