import { useState } from "react";
import { LogOut, Plus, X } from "lucide-react";
import type { Task, TaskStatus } from "../api/contracts";
import { usePreviewTasks } from "../preview/workspace";
import { ActionButton } from "../components/ActionButton";
import { Brand } from "../components/Brand";
import { Modal } from "../components/Modal";
import { TaskForm } from "../components/TaskForm";
import { TaskList } from "../components/TaskList";
import { TaskSummary } from "../components/TaskSummary";
import { TaskToolbar } from "../components/TaskToolbar";
import { TaskState } from "../components/TaskState";
import { Pagination } from "../components/Pagination";

const PAGE_SIZE = 6;
export function Dashboard({
  name,
  logout,
}: {
  name: string;
  logout: () => void;
}) {
  const { tasks, counts, mode, busy, reload, save, toggle, remove } =
    usePreviewTasks();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<TaskStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Task | null | undefined>();
  const [deleting, setDeleting] = useState<Task | null>(null);
  const filtered = tasks.filter(
    (task) =>
      task.title.toLowerCase().includes(query.trim().toLowerCase()) &&
      (status === "all" || task.status === status),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  async function complete(task: Task) {
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
              onClick={logout}
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
            disabled={busy || mode !== "ready"}
          >
            <Plus size={18} />
            New task
          </button>
        </div>
        {mode === "ready" && <TaskSummary counts={counts} />}
        <section
          className="tasks-panel"
          aria-labelledby="tasks-heading"
          aria-busy={mode === "loading"}
        >
          <div className="task-panel-heading">
            <h2 id="tasks-heading">
              Your tasks {mode === "ready" && <span>{tasks.length}</span>}
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
              {filtered.length} matching tasks
            </p>
          )}
          {error && !deleting && (
            <p className="error task-error" role="alert">
              {error}
            </p>
          )}
          {mode !== "ready" || !visible.length ? (
            <TaskState
              mode={mode === "ready" ? "empty" : mode}
              hasTasks={tasks.length > 0}
              onRetry={() => void reload()}
              onClear={clearFilters}
              onCreate={() => setEditing(null)}
            />
          ) : (
            <>
              <TaskList
                tasks={visible}
                busy={busy}
                onToggle={(task) => void complete(task)}
                onEdit={setEditing}
                onDelete={(task) => {
                  setError("");
                  setDeleting(task);
                }}
              />
              <Pagination
                page={currentPage}
                pages={pages}
                total={filtered.length}
                limit={PAGE_SIZE}
                onPage={setPage}
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
