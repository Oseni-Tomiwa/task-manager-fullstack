import { useEffect, useRef, useState } from "react";
import { LogOut, Plus, X } from "lucide-react";
import type { Task, TaskStatus } from "../api/contracts";
import { useTasks, PAGE_SIZE } from "../tasks/useTasks";
import type { createApiClient } from "../api/client";
import { ActionButton } from "../components/ActionButton";
import { Brand } from "../components/Brand";
import { Modal } from "../components/Modal";
import { TaskForm } from "../components/TaskForm";
import { TaskList } from "../components/TaskList";
import { TaskSummary } from "../components/TaskSummary";
import { TaskToolbar } from "../components/TaskToolbar";
import { TaskState } from "../components/TaskState";
import { Pagination } from "../components/Pagination";

export function Dashboard({
  name,
  api,
  logout,
}: {
  name: string;
  api: ReturnType<typeof createApiClient>;
  logout: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<TaskStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Task | null | undefined>();
  const [deleting, setDeleting] = useState<Task | null>(null);
  const {
    tasks,
    meta,
    counts,
    mode,
    summaryMode,
    retrySummary,
    hasLoaded,
    busy: saving,
    reload,
    save,
    toggle,
    remove,
  } = useTasks(api, query, status, page, setPage);
  const [loggingOut, setLoggingOut] = useState(false);
  const busy = saving || loggingOut;
  const focusAfterLoad = useRef<{
    trigger: Element | null;
    taskId?: string;
  } | null>(null);
  useEffect(() => {
    if (mode !== "ready" || busy || !focusAfterLoad.current) return;
    const pending = focusAfterLoad.current;
    focusAfterLoad.current = null;
    // A user may have moved to search while waiting: never steal that focus.
    if (
      document.activeElement !== document.body &&
      document.activeElement !== pending.trigger
    )
      return;
    const toggle = pending.taskId
      ? Array.from(
          document.querySelectorAll<HTMLButtonElement>("[data-task-toggle]"),
        ).find((button) => button.dataset.taskToggle === pending.taskId)
      : undefined;
    (toggle ?? document.getElementById("tasks-heading"))?.focus();
  }, [mode, busy, tasks]);
  async function signOut() {
    if (busy) return;
    setLoggingOut(true);
    setError("");
    try {
      await logout();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "We couldn’t log you out. Please try again.",
      );
    } finally {
      setLoggingOut(false);
    }
  }
  async function complete(task: Task) {
    focusAfterLoad.current = {
      trigger: document.activeElement,
      taskId: task.id,
    };
    setError("");
    setNotice("");
    try {
      await toggle(task);
      setNotice(
        task.status === "completed"
          ? "Task marked incomplete."
          : "Task completed. A little win worth celebrating.",
      );
    } catch (error) {
      focusAfterLoad.current = null;
      setError(
        error instanceof Error
          ? error.message
          : "We couldn’t update your task. Try again.",
      );
    }
  }
  async function deleteTask() {
    if (!deleting || busy) return;
    setError("");
    try {
      await remove(deleting);
      setDeleting(null);
      setNotice("Task deleted.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "We couldn’t delete your task. Try again.",
      );
    }
  }
  function closeEdit() {
    if (!busy) setEditing(undefined);
  }
  function clearFilters() {
    setQuery("");
    setStatus("all");
    setPage(1);
  }
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <Brand />
          <span className="workspace-label">Personal workspace</span>
          <div className="account">
            <span className="avatar" aria-hidden="true">
              {name.slice(0, 1).toUpperCase()}
            </span>
            <span className="account-name">{name}</span>
            <ActionButton
              label="Log out"
              tooltip="Log out"
              onClick={() => void signOut()}
              disabled={busy}
            >
              <LogOut size={18} />
            </ActionButton>
          </div>
        </div>
      </header>
      <main className="dashboard" id="main-content">
        <div className="page-heading">
          <div>
            <div className="eyebrow">A LITTLE FOCUS GOES A LONG WAY</div>
            <h1 tabIndex={-1}>Let’s make progress, {name.split(" ")[0]}.</h1>
            <p className="muted">
              Your plans, your pace. Here’s what’s on your plate.
            </p>
          </div>
          <button
            className="primary"
            onClick={() => setEditing(null)}
            disabled={busy || !hasLoaded}
          >
            <Plus size={18} />
            New task
          </button>
        </div>
        {counts && <TaskSummary counts={counts} />}
        {summaryMode === "loading" && (
          <p className="muted" role="status">
            Loading task summary…
          </p>
        )}
        {summaryMode === "error" && (
          <div className="task-error">
            <p className="error" role="alert">
              We couldn’t load your task summary.
            </p>
            <button className="secondary" onClick={retrySummary}>
              Retry summary
            </button>
          </div>
        )}
        <section
          className="tasks-panel"
          aria-labelledby="tasks-heading"
          aria-busy={mode === "loading"}
        >
          <div className="task-panel-heading">
            <h2 id="tasks-heading" tabIndex={-1}>
              Your tasks {mode === "ready" && <span>{meta?.total}</span>}
            </h2>
            <span className="muted text-sm">A clearer view of what’s next</span>
          </div>
          <TaskToolbar
            query={query}
            status={status}
            onQuery={(value) => {
              setQuery(value);
              setPage(1);
            }}
            onStatus={(value) => {
              setStatus(value);
              setPage(1);
            }}
          />
          {mode === "ready" && (
            <p className="sr-only" role="status">
              {meta?.total} matching tasks
            </p>
          )}
          {error && !deleting && (
            <p className="error task-error" role="alert">
              {error}
            </p>
          )}
          {mode !== "ready" || !tasks.length ? (
            <TaskState
              mode={mode === "ready" ? "empty" : mode}
              hasTasks={Boolean(
                query.trim() || status !== "all" || (counts?.total ?? 0) > 0,
              )}
              onRetry={() => void reload()}
              onClear={clearFilters}
              onCreate={() => setEditing(null)}
            />
          ) : (
            <>
              <TaskList
                tasks={tasks}
                busy={busy}
                onToggle={(task) => void complete(task)}
                onEdit={setEditing}
                onDelete={(task) => {
                  setError("");
                  setDeleting(task);
                }}
              />
              <Pagination
                page={meta!.page}
                pages={Math.max(1, meta!.totalPages)}
                total={meta!.total}
                limit={PAGE_SIZE}
                onPage={(nextPage) => {
                  focusAfterLoad.current = { trigger: document.activeElement };
                  setPage(nextPage);
                }}
              />
            </>
          )}
        </section>
        <footer className="dashboard-footer">
          <span>A little more organized. A little more you.</span>
          <span>TaskFlow · Personal task management</span>
        </footer>
      </main>
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button
            className="icon-button"
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {editing !== undefined && (
        <Modal
          title={editing ? "Edit task" : "Make a little progress."}
          onClose={closeEdit}
          busy={busy}
        >
          <TaskForm
            task={editing}
            busy={busy}
            onClose={closeEdit}
            onSave={async (values) => {
              await save(editing, values);
              setEditing(undefined);
              setPage(1);
              setNotice(
                editing
                  ? "Changes saved."
                  : "Task created. You’re one step closer.",
              );
            }}
          />
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Delete this task?"
          busy={busy}
          onClose={() => {
            if (!busy) {
              setDeleting(null);
              setError("");
            }
          }}
        >
          <p className="delete-copy">
            “{deleting.title}” will be removed from your workspace. This can’t
            be undone.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="secondary"
              data-initial-focus
              disabled={busy}
              onClick={() => {
                setDeleting(null);
                setError("");
              }}
            >
              Keep task
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={() => void deleteTask()}
            >
              {busy ? "Deleting…" : "Delete task"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
