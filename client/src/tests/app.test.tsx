import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it } from "vitest";
import { httpFixture, testUser, failure, json, deferred } from "./httpFixture";
let http: ReturnType<typeof httpFixture>;
beforeEach(() => {
  http = httpFixture();
});
import App from "../App";

function open(path = "/login") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}
async function signIn(expectList = true) {
  const user = userEvent.setup();
  await user.type(
    await screen.findByLabelText("Email address"),
    "demo@taskflow.app",
  );
  await user.type(
    screen.getByLabelText("Password", { exact: true }),
    "TaskflowDemo!2026",
  );
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  await screen.findByRole("heading", { name: /Let’s make progress/ });
  if (expectList) await screen.findByRole("list", { name: "Tasks" });
  return user;
}
it("guards the dashboard after session restoration and navigates auth screens", async () => {
  open("/dashboard");
  expect(
    await screen.findByRole("heading", { name: "Welcome back." }),
  ).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Welcome back." })).toHaveFocus();
  expect(screen.queryByText("Phase 4.1 preview")).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("link", { name: "Create an account" }),
  );
  expect(
    screen.getByRole("heading", { name: "A fresh start awaits." }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "A fresh start awaits." }),
  ).toHaveFocus();
  expect(screen.getByLabelText("Full name")).toBeInTheDocument();
});
it("associates validation errors with inputs and supports password visibility", async () => {
  open("/register");
  const user = userEvent.setup();
  await screen.findByLabelText("Full name");
  await user.click(screen.getByRole("button", { name: "Create account" }));
  expect(screen.getByLabelText("Full name")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(screen.getByLabelText("Email address")).toHaveAccessibleDescription(
    /valid email/,
  );
  const password = screen.getByLabelText("Password", { exact: true });
  expect(password).toHaveAttribute("type", "password");
  await user.click(screen.getByRole("button", { name: "Show password" }));
  expect(password).toHaveAttribute("type", "text");
});
it("rejects wrong credentials, registers through the API and logs out", async () => {
  open();
  const user = userEvent.setup();
  await user.type(
    await screen.findByLabelText("Email address"),
    "wrong@example.com",
  );
  await user.type(
    screen.getByLabelText("Password", { exact: true }),
    "Wrong password 123!",
  );
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    /Email or password/,
  );
  await user.click(screen.getByRole("link", { name: "Create an account" }));
  await user.type(screen.getByLabelText("Full name"), "Ada Demo");
  await user.type(screen.getByLabelText("Email address"), "ada@example.com");
  await user.type(
    screen.getByLabelText("Password", { exact: true }),
    "A made-up password!",
  );
  await user.click(screen.getByRole("button", { name: "Create account" }));
  expect(
    await screen.findByRole("heading", { name: /Ada/ }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Log out" }));
  expect(
    await screen.findByRole("heading", { name: "Welcome back." }),
  ).toBeInTheDocument();
});
it("renders summary, paginates and combines literal search with production status filters", async () => {
  open();
  const user = await signIn();
  const summary = screen.getByRole("region", { name: "Task summary" });
  expect(within(summary).getByText("12")).toBeInTheDocument();
  expect(
    within(screen.getByRole("list", { name: "Tasks" })).getAllByRole(
      "listitem",
    ),
  ).toHaveLength(6);
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText("2 / 2")).toBeInTheDocument();
  await user.type(screen.getByRole("textbox", { name: "Search tasks" }), "API");
  expect(
    await screen.findByText("Review the API architecture"),
  ).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Filter by status"), "todo");
  expect(
    await screen.findByText("No tasks match just yet."),
  ).toBeInTheDocument();
  expect(within(summary).getByText("12")).toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Clear search and filters" }),
  );
  expect(screen.getByText("1 / 2")).toBeInTheDocument();
});
it("creates, edits, completes and deletes tasks with safe dialog focus and cancel", async () => {
  open();
  const user = await signIn();
  const trigger = screen.getByRole("button", { name: "New task" });
  await user.click(trigger);
  let dialog = screen.getByRole("dialog");
  expect(within(dialog).getByLabelText("Task title")).toHaveFocus();
  await user.type(
    within(dialog).getByLabelText("Task title"),
    "A focused new task",
  );
  await user.click(within(dialog).getByRole("button", { name: "Create task" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(trigger).toHaveFocus();
  await user.click(
    await screen.findByRole("button", { name: "Edit: A focused new task" }),
  );
  dialog = screen.getByRole("dialog");
  expect(within(dialog).getByLabelText("Task title")).toHaveValue(
    "A focused new task",
  );
  await user.selectOptions(
    within(dialog).getByLabelText("Status"),
    "in_progress",
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Save changes" }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  await user.click(
    await screen.findByRole("button", {
      name: "Mark complete: A focused new task",
    }),
  );
  expect(
    await screen.findByRole("button", {
      name: "Mark incomplete: A focused new task",
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await user.click(
    screen.getByRole("button", { name: "Mark incomplete: A focused new task" }),
  );
  const incomplete = await screen.findByRole("button", {
    name: "Mark complete: A focused new task",
  });
  expect(incomplete).toHaveAttribute("aria-pressed", "false");
  expect(
    within(incomplete.closest("li")!).getByText("Pending"),
  ).toBeInTheDocument();
  await user.click(
    await screen.findByRole("button", { name: "Delete: A focused new task" }),
  );
  dialog = screen.getByRole("dialog");
  expect(
    within(dialog).getByRole("button", { name: "Keep task" }),
  ).toHaveFocus();
  await user.click(within(dialog).getByRole("button", { name: "Keep task" }));
  expect(screen.getByText("A focused new task")).toBeInTheDocument();
  await user.click(
    await screen.findByRole("button", { name: "Delete: A focused new task" }),
  );
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Delete task",
    }),
  );
  await waitFor(() =>
    expect(screen.queryByText("A focused new task")).not.toBeInTheDocument(),
  );
  expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
});
it("wraps keyboard focus in dialogs and closes safely on Escape", async () => {
  open();
  const user = await signIn();
  await user.click(screen.getByRole("button", { name: "New task" }));
  const dialog = screen.getByRole("dialog");
  const close = within(dialog).getByRole("button", { name: "Close dialog" });
  close.focus();
  expect(close).toHaveFocus();
  await user.tab({ shift: true });
  expect(
    within(dialog).getByRole("button", { name: "Create task" }),
  ).toHaveFocus();
  // Native Escape emits cancel in the browser; jsdom needs that event explicitly.
  fireEvent(dialog, new Event("cancel", { cancelable: true, bubbles: false }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("distinguishes initial loading from loaded data", async () => {
  http.state.override = (path) =>
    path.startsWith("/api/tasks") ? new Promise<Response>(() => {}) : undefined;
  open();
  await signIn(false);
  expect(
    screen.getByRole("heading", { name: "Finding your flow…" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("list", { name: "Tasks" })).not.toBeInTheDocument();
  expect(
    screen.queryByRole("region", { name: "Task summary" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "New task" })).toBeDisabled();
});
it("retries a failed load and recovers the task list", async () => {
  http.state.override = (path) =>
    path.startsWith("/api/tasks?") ? failure(503) : undefined;
  open();
  const user = await signIn(false);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "We couldn’t load your tasks",
  );
  http.state.override = undefined;
  await user.click(screen.getByRole("button", { name: "Try again" }));
  expect(
    await screen.findByRole("list", { name: "Tasks" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("offers a first-task action for an empty workspace", async () => {
  http.state.tasks = [];
  open();
  const user = await signIn(false);
  expect(
    await screen.findByText("A clear space. A fresh start."),
  ).toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Create your first task" }),
  );
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});
it("retains task form values after failed save, blocks dismissal while pending and retries", async () => {
  let failed = false;
  http.state.override = (path, init) => {
    if (path.startsWith("/api/tasks") && init.method !== "GET" && !failed) {
      failed = true;
      return new Promise<Response>((resolve) =>
        setTimeout(
          () => resolve(failure(500, "We couldn’t save that change.")),
          80,
        ),
      );
    }
  };
  open();
  const user = await signIn();
  await user.click(screen.getByRole("button", { name: "New task" }));
  const dialog = screen.getByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Create task" }));
  expect(
    within(dialog).getByLabelText("Task title"),
  ).toHaveAccessibleDescription(/Give your task a title/);
  await user.type(
    within(dialog).getByLabelText("Task title"),
    "Keep these changes",
  );
  await user.type(
    within(dialog).getByLabelText(/Description/),
    "My unsaved context",
  );
  await user.click(within(dialog).getByRole("button", { name: "Create task" }));
  expect(
    within(dialog).getByRole("button", { name: "Saving…" }),
  ).toBeDisabled();
  expect(
    within(dialog).getByRole("button", { name: "Close dialog" }),
  ).toBeDisabled();
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  expect(dialog).toBeInTheDocument();
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    /couldn’t save/,
  );
  expect(within(dialog).getByLabelText("Task title")).toHaveValue(
    "Keep these changes",
  );
  expect(within(dialog).getByLabelText(/Description/)).toHaveValue(
    "My unsaved context",
  );
  await user.click(within(dialog).getByRole("button", { name: "Create task" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(screen.getByText("Keep these changes")).toBeInTheDocument();
});
it("preserves a task after failed deletion and allows a safe retry", async () => {
  let failed = false;
  http.state.override = (path, init) => {
    if (path.startsWith("/api/tasks") && init.method !== "GET" && !failed) {
      failed = true;
      return new Promise<Response>((resolve) =>
        setTimeout(
          () => resolve(failure(500, "We couldn’t save that change.")),
          80,
        ),
      );
    }
  };
  open();
  const user = await signIn();
  await user.click(
    screen.getByRole("button", {
      name: "Delete: Map out the TaskFlow user journey",
    }),
  );
  const dialog = screen.getByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Delete task" }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    /couldn’t save/,
  );
  expect(
    screen.getByText("Map out the TaskFlow user journey"),
  ).toBeInTheDocument();
  await user.click(within(dialog).getByRole("button", { name: "Delete task" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(
    screen.queryByText("Map out the TaskFlow user journey"),
  ).not.toBeInTheDocument();
});

it("restores the HttpOnly session before rendering a protected route", async () => {
  const pending = deferred<Response>();
  http.state.override = (path) =>
    path === "/api/auth/me" ? pending.promise : undefined;
  http.state.user = testUser;
  open("/dashboard");
  expect(screen.getByRole("status")).toHaveTextContent(/session/i);
  expect(screen.queryByLabelText("Email address")).not.toBeInTheDocument();
  pending.resolve(json({ data: { user: testUser } }));
  await screen.findByRole("list", { name: "Tasks" });
});
it("retries failed session restoration without pretending the user is logged out", async () => {
  http.state.user = testUser;
  http.state.override = (path) =>
    path === "/api/auth/me" ? failure(503) : undefined;
  open("/dashboard");
  expect(await screen.findByRole("alert")).toHaveTextContent(/session/i);
  expect(screen.queryByLabelText("Email address")).not.toBeInTheDocument();
  http.state.override = undefined;
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByRole("list", { name: "Tasks" });
});
it("retains the session when logout fails and allows retry", async () => {
  http.state.user = testUser;
  open("/dashboard");
  await screen.findByRole("list", { name: "Tasks" });
  http.state.override = (path) =>
    path === "/api/auth/logout"
      ? failure(503, "Logout unavailable. Try again.")
      : undefined;
  await userEvent.click(screen.getByRole("button", { name: "Log out" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Logout unavailable",
  );
  expect(screen.getByRole("list", { name: "Tasks" })).toBeInTheDocument();
  http.state.override = undefined;
  await userEvent.click(screen.getByRole("button", { name: "Log out" }));
  await screen.findByRole("heading", { name: "Welcome back." });
});
it("clears private UI on protected request 401 and explains session expiry", async () => {
  http.state.user = testUser;
  open("/dashboard");
  await screen.findByRole("list", { name: "Tasks" });
  http.state.override = (path) =>
    path.startsWith("/api/tasks") ? failure(401) : undefined;
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByRole("heading", { name: "Welcome back." });
  expect(screen.getByRole("alert")).toHaveTextContent(/session.*expired/i);
  expect(screen.queryByRole("list", { name: "Tasks" })).not.toBeInTheDocument();
});
it("does not misreport successful creation when subsequent refresh fails", async () => {
  http.state.user = testUser;
  open("/dashboard");
  await screen.findByRole("list", { name: "Tasks" });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "New task" }));
  await user.type(screen.getByLabelText("Task title"), "Persisted once");
  http.state.override = (path, init) =>
    path.startsWith("/api/tasks") && init.method === "GET"
      ? failure(503)
      : undefined;
  await user.click(screen.getByRole("button", { name: "Create task" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(
    screen.getByText("Task created. You’re one step closer."),
  ).toBeInTheDocument();
  expect(
    http.state.tasks.filter((t) => t.title === "Persisted once"),
  ).toHaveLength(1);
  await screen.findByText(
    "We couldn’t load your tasks. Your work hasn’t changed.",
  );
  http.state.override = undefined;
  await user.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByText("Persisted once");
  expect(
    http.transport.mock.calls.filter(
      ([path, init]) => path === "/api/tasks" && init?.method === "POST",
    ),
  ).toHaveLength(1);
});
it("shows a summary error without fabricating zeros or hiding a successful list", async () => {
  http.state.user = testUser;
  http.state.override = (path) =>
    path === "/api/tasks/summary" ? failure(503) : undefined;
  open("/dashboard");
  await screen.findByRole("list", { name: "Tasks" });
  expect(
    screen.queryByRole("region", { name: "Task summary" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent(/summary/i);
  http.state.override = undefined;
  await userEvent.click(screen.getByRole("button", { name: "Retry summary" }));
  await screen.findByRole("region", { name: "Task summary" });
});
it("cancels obsolete search reads and ignores late results when transport ignores abort", async () => {
  http.state.user = testUser;
  const old = deferred<Response>();
  let oldSignal: AbortSignal | null | undefined;
  http.state.override = (path, init) => {
    if (path.includes("q=old")) {
      oldSignal = init.signal;
      return old.promise;
    }
  };
  open("/dashboard");
  await screen.findByRole("list", { name: "Tasks" });
  const search = screen.getByRole("textbox", { name: "Search tasks" });
  await userEvent.type(search, "old");
  await waitFor(() => expect(oldSignal).toBeDefined());
  await userEvent.clear(search);
  await userEvent.type(search, "API");
  await screen.findByText("Review the API architecture");
  expect(oldSignal!.aborted).toBe(true);
  old.resolve(
    json({
      data: { tasks: [] },
      meta: { page: 1, limit: 6, total: 0, totalPages: 0 },
    }),
  );
  await waitFor(() =>
    expect(screen.getByText("Review the API architecture")).toBeInTheDocument(),
  );
});
it("recovers the preceding server page after deleting the final task on a page", async () => {
  http.state.user = testUser;
  http.state.tasks = http.state.tasks.slice(0, 7);
  open("/dashboard");
  await screen.findByRole("list", { name: "Tasks" });
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("2 / 2");
  await userEvent.click(
    screen.getByRole("button", {
      name: `Delete: ${http.state.tasks[6].title}`,
    }),
  );
  await userEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Delete task",
    }),
  );
  await screen.findByText("1 / 1");
  expect(screen.getByRole("list", { name: "Tasks" })).toBeInTheDocument();
});

it("retains registration inputs and associates authoritative server validation errors", async () => {
  http.state.override = (path) =>
    path === "/api/auth/register"
      ? json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Check your details.",
              fields: { email: ["Enter a valid email address."] },
            },
          },
          400,
        )
      : undefined;
  open("/register");
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Full name"), "Retained Name");
  await user.type(
    screen.getByLabelText("Email address"),
    "retained@example.com",
  );
  await user.type(
    screen.getByLabelText("Password", { exact: true }),
    "Retained password 123!",
  );
  await user.click(screen.getByRole("button", { name: "Create account" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Check your details",
  );
  expect(screen.getByLabelText("Full name")).toHaveValue("Retained Name");
  expect(screen.getByLabelText("Email address")).toHaveAccessibleDescription(
    "Enter a valid email address.",
  );
  expect(screen.getByLabelText("Password", { exact: true })).toHaveValue(
    "Retained password 123!",
  );
});
it("retains sign-in values after a network error and supports retry", async () => {
  http.state.override = (path) => {
    if (path === "/api/auth/login") throw new TypeError("connection refused");
    return undefined;
  };
  open();
  const user = userEvent.setup();
  await user.type(
    await screen.findByLabelText("Email address"),
    "demo@taskflow.app",
  );
  await user.type(
    screen.getByLabelText("Password", { exact: true }),
    "TaskflowDemo!2026",
  );
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    /couldn’t reach TaskFlow/,
  );
  expect(screen.getByLabelText("Email address")).toHaveValue(
    "demo@taskflow.app",
  );
  http.state.override = undefined;
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  await screen.findByRole("list", { name: "Tasks" });
});
it("sends a pending creation only once even when its form is submitted twice", async () => {
  http.state.user = testUser;
  open("/dashboard");
  await screen.findByRole("list", { name: "Tasks" });
  await userEvent.click(screen.getByRole("button", { name: "New task" }));
  await userEvent.type(screen.getByLabelText("Task title"), "Only once");
  const pending = deferred<Response>();
  http.state.override = (path, init) =>
    path === "/api/tasks" && init.method === "POST"
      ? pending.promise
      : undefined;
  const form = screen.getByLabelText("Task title").closest("form")!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  expect(
    http.transport.mock.calls.filter(
      ([path, init]) => path === "/api/tasks" && init?.method === "POST",
    ),
  ).toHaveLength(1);
  pending.resolve(
    json(
      { data: { task: { ...http.state.tasks[0], title: "Only once" } } },
      201,
    ),
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
});
it("aborts private reads on logout and ignores their late unauthorized responses after another login", async () => {
  http.state.user = testUser;
  const pending = deferred<Response>();
  let signal: AbortSignal | null | undefined;
  http.state.override = (path, init) => {
    if (path.startsWith("/api/tasks?")) {
      signal = init.signal;
      return pending.promise;
    }
  };
  open("/dashboard");
  await waitFor(() => expect(signal).toBeDefined());
  await userEvent.click(screen.getByRole("button", { name: "Log out" }));
  await screen.findByLabelText("Email address");
  expect(signal!.aborted).toBe(true);
  http.state.override = undefined;
  await signIn();
  pending.resolve(failure(401));
  await waitFor(() =>
    expect(screen.getByRole("list", { name: "Tasks" })).toBeInTheDocument(),
  );
  expect(screen.queryByLabelText("Email address")).not.toBeInTheDocument();
});

it("restores meaningful keyboard focus after pagination and completion reloads", async () => {
  http.state.user = testUser;
  open("/dashboard");
  await screen.findByRole("list", { name: "Tasks" });
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("2 / 2");
  expect(screen.getByRole("heading", { name: "Your tasks 12" })).toHaveFocus();
  await userEvent.click(
    screen.getByRole("button", {
      name: "Mark complete: Prepare prototype walkthrough",
    }),
  );
  expect(
    await screen.findByRole("button", {
      name: "Mark incomplete: Prepare prototype walkthrough",
    }),
  ).toHaveFocus();
});

it("does not steal search focus when a pagination read finishes later", async () => {
  http.state.user = testUser;
  open("/dashboard");
  await screen.findByRole("list", { name: "Tasks" });
  const pending = deferred<Response>();
  http.state.override = (path) =>
    path.includes("page=2") ? pending.promise : undefined;
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  const search = screen.getByRole("textbox", { name: "Search tasks" });
  await userEvent.click(search);
  await act(async () => {
    pending.resolve(
      json({
        data: { tasks: http.state.tasks.slice(6) },
        meta: { page: 2, limit: 6, total: 12, totalPages: 2 },
      }),
    );
  });
  await screen.findByText("2 / 2");
  expect(search).toHaveFocus();
});
it("does not restore stale summary data after logout and another session", async () => {
  http.state.user = testUser;
  const pending = deferred<Response>();
  let signal: AbortSignal | null | undefined;
  http.state.override = (path, init) => {
    if (path === "/api/tasks/summary") {
      signal = init.signal;
      return pending.promise;
    }
  };
  open("/dashboard");
  await screen.findByRole("list", { name: "Tasks" });
  await userEvent.click(screen.getByRole("button", { name: "Log out" }));
  await screen.findByLabelText("Email address");
  expect(signal!.aborted).toBe(true);
  http.state.tasks = [];
  http.state.override = undefined;
  await signIn(false);
  await screen.findByRole("region", { name: "Task summary" });
  await act(async () => {
    pending.resolve(
      json({
        data: {
          summary: { total: 999, todo: 999, in_progress: 0, completed: 0 },
        },
      }),
    );
  });
  expect(screen.queryByText("999")).not.toBeInTheDocument();
  expect(screen.getByText("A clear space. A fresh start.")).toBeInTheDocument();
});
