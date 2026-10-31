import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
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
  await user.type(screen.getByLabelText("Email address"), "demo@taskflow.app");
  await user.type(
    screen.getByLabelText("Password", { exact: true }),
    "TaskflowDemo!2026",
  );
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  await screen.findByRole("heading", { name: /Let’s make progress/ });
  if (expectList) await screen.findByRole("list", { name: "Tasks" });
  return user;
}
it("guards the dashboard, navigates between auth screens and labels preview behavior", async () => {
  open("/dashboard");
  expect(
    await screen.findByRole("heading", { name: "Welcome back." }),
  ).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Welcome back." })).toHaveFocus();
  expect(screen.getByText("Phase 4.1 preview")).toBeInTheDocument();
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
it("rejects wrong preview credentials, registers without persistence and logs out", async () => {
  open();
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email address"), "wrong@example.com");
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
    screen.getByRole("button", { name: "Edit: A focused new task" }),
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
    screen.getByRole("button", { name: "Mark complete: A focused new task" }),
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
    screen.getByRole("button", { name: "Delete: A focused new task" }),
  );
  dialog = screen.getByRole("dialog");
  expect(
    within(dialog).getByRole("button", { name: "Keep task" }),
  ).toHaveFocus();
  await user.click(within(dialog).getByRole("button", { name: "Keep task" }));
  expect(screen.getByText("A focused new task")).toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Delete: A focused new task" }),
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
it("never fetches real services while previewing session and task actions", async () => {
  const network = vi.spyOn(globalThis, "fetch");
  open();
  const user = await signIn();
  await user.click(
    screen.getByRole("button", {
      name: "Mark complete: Map out the TaskFlow user journey",
    }),
  );
  await screen.findByRole("button", {
    name: "Mark incomplete: Map out the TaskFlow user journey",
  });
  expect(network).not.toHaveBeenCalled();
});

it("distinguishes initial loading from loaded data", async () => {
  window.history.replaceState({}, "", "/?previewState=loading");
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
  window.history.replaceState({}, "", "/?previewState=error");
  open();
  const user = await signIn(false);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "We couldn’t load your tasks",
  );
  await user.click(screen.getByRole("button", { name: "Try again" }));
  expect(
    await screen.findByRole("list", { name: "Tasks" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("offers a first-task action for an empty workspace", async () => {
  window.history.replaceState({}, "", "/?previewState=empty");
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
  window.history.replaceState({}, "", "/?previewState=save-error");
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
  window.history.replaceState({}, "", "/?previewState=save-error");
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
