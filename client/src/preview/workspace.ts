import { useEffect, useState } from "react";
import type { RegisterInput, Task, TaskValues } from "../api/contracts";

// Phase 4.1 only. Remove this module and fixtures when wiring Phase 4.2.
// No credentials, sessions or tasks are stored outside this page's memory.
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
export function previewTasks(): Task[] {
  return titles.map((title, index) => ({
    id: (index + 1).toString(16).padStart(24, "0"),
    title,
    description: [
      "Keep the experience simple, clear and focused on what matters.",
      "Explore the details and capture decisions for the next milestone.",
      "Review the prototype with fresh eyes and note any improvements.",
    ][index % 3],
    status: (["in_progress", "todo", "completed"] as const)[index % 3],
    createdAt: new Date(Date.UTC(2026, 9, 29 - index)).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 9, 29 - index)).toISOString(),
  }));
}
const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 150));
async function previewSignIn(
  values: RegisterInput,
  register: boolean,
): Promise<string> {
  await pause();
  if (
    !register &&
    (values.email !== "demo@taskflow.app" ||
      values.password !== "TaskflowDemo!2026")
  ) {
    throw new Error(
      "Email or password is incorrect. Use the preview credentials below.",
    );
  }
  return register ? values.name : "Tomiwa";
}
export function usePreviewSession() {
  const [user, setUser] = useState<string | null>(null);
  return {
    user,
    signIn: async (values: RegisterInput, register: boolean) =>
      setUser(await previewSignIn(values, register)),
    logout: () => setUser(null),
  };
}
export function usePreviewTasks() {
  const [scenario] = useState(() =>
    new URLSearchParams(window.location.search).get("previewState"),
  );
  const [tasks, setTasks] = useState(() =>
    scenario === "empty" ? [] : previewTasks(),
  );
  const [mode, setMode] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [failedOnce, setFailedOnce] = useState(false);
  useEffect(() => {
    if (scenario === "loading") return;
    const timer = setTimeout(
      () => setMode(scenario === "error" ? "error" : "ready"),
      150,
    );
    return () => clearTimeout(timer);
  }, [scenario]);
  async function mutate(action: () => void) {
    setBusy(true);
    try {
      await pause();
      if (scenario === "save-error" && !failedOnce) {
        setFailedOnce(true);
        throw new Error(
          "We couldn’t save that change. Your work is still here. Please try again.",
        );
      }
      action();
    } finally {
      setBusy(false);
    }
  }
  return {
    tasks,
    counts: {
      total: tasks.length,
      todo: tasks.filter((task) => task.status === "todo").length,
      in_progress: tasks.filter((task) => task.status === "in_progress").length,
      completed: tasks.filter((task) => task.status === "completed").length,
    },
    mode,
    busy,
    reload: async () => {
      setMode("loading");
      await pause();
      setMode("ready");
    },
    save: (task: Task | null, values: TaskValues) =>
      mutate(() => {
        const now = new Date().toISOString();
        setTasks((previous) =>
          task
            ? previous.map((item) =>
                item.id === task.id
                  ? { ...item, ...values, updatedAt: now }
                  : item,
              )
            : [
                {
                  ...values,
                  id: crypto.randomUUID(),
                  createdAt: now,
                  updatedAt: now,
                },
                ...previous,
              ],
        );
      }),
    toggle: (task: Task) =>
      mutate(() =>
        setTasks((previous) =>
          previous.map((item) =>
            item.id === task.id
              ? {
                  ...item,
                  status: item.status === "completed" ? "todo" : "completed",
                  updatedAt: new Date().toISOString(),
                }
              : item,
          ),
        ),
      ),
    remove: (task: Task) =>
      mutate(() =>
        setTasks((previous) => previous.filter((item) => item.id !== task.id)),
      ),
  };
}
