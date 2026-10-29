import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  ArrowRight,
  Check,
  CheckCheck,
  Circle,
  CircleCheck,
  ClipboardList,
  Layers,
  LogOut,
  Plus,
  Search,
  SlidersHorizontal,
  Pencil,
  Trash2,
  X,
  LoaderCircle,
  AlertCircle,
  ArrowUpRight,
} from "lucide-react";
import { filterTasks, labels, pause, seedTasks } from "./model";
import type { Status, Task } from "./model";
import "./styles.css";

function ActionButton({
  label,
  tooltip,
  onClick,
  children,
  destructive = false,
}: {
  label: string;
  tooltip: string;
  onClick: () => void;
  children: ReactNode;
  destructive?: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  return (
    <button
      type="button"
      className={`icon-button action-button${destructive ? " delete-button" : ""}${dismissed ? " tooltip-dismissed" : ""}`}
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => setDismissed(false)}
      onFocus={() => setDismissed(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setDismissed(true);
          e.stopPropagation();
        }
      }}
    >
      {children}
      <span className="action-tooltip" aria-hidden="true">
        {tooltip}
      </span>
    </button>
  );
}
function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <CheckCheck size={23} />
      </span>
      TaskFlow<span className="brand-dot">.</span>
    </span>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const dialog = ref.current!;
    dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
    return () => {
      dialog.close();
      if (previous?.isConnected) previous.focus();
      else document.querySelector<HTMLHeadingElement>("h1")?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const items = Array.from(
          e.currentTarget.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex='0']",
          ),
        );
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="modal-head">
        <div>
          <span className="eyebrow">YOUR WORKSPACE</span>
          <h2 id="dialog-title">{title}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Auth({
  register,
  onLogin,
}: {
  register: boolean;
  onLogin: (name: string) => void;
}) {
  const [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password"));
    if (
      register &&
      (password.length < 12 || new TextEncoder().encode(password).length > 72)
    ) {
      setError("Use at least 12 characters and no more than 72 UTF-8 bytes.");
      return;
    }
    setBusy(true);
    setError("");
    await pause();
    if (
      !register &&
      (String(data.get("email")).trim().toLowerCase() !== "demo@taskflow.app" ||
        password !== "TaskflowDemo!2026")
    ) {
      setError(
        "Email or password is incorrect. Try the demo credentials below.",
      );
      setBusy(false);
      return;
    }
    const name = register ? String(data.get("name")).trim() : "Tomiwa";
    if (!name) {
      setError("Please enter your name.");
      setBusy(false);
      return;
    }
    form.reset();
    onLogin(name);
  }
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div className="story-content">
          <span className="pill">A LITTLE CLARITY. A LOT OF PROGRESS.</span>
          <h1 tabIndex={-1}>
            Make room for
            <br />
            your best work.
          </h1>
          <p>
            Bring your tasks together, find your focus, and move forward. One
            small win at a time.
          </p>
          <div className="story-card">
            <span className="story-check">
              <Check size={22} />
            </span>
            <div>
              <strong>Progress feels good.</strong>
              <p>Your next great day starts with a plan.</p>
            </div>
            <span className="mini-bars">
              <i />
              <i />
              <i />
              <i />
            </span>
          </div>
        </div>
        <footer>
          Built for focus. Designed for you.<span>TaskFlow / 2026</span>
        </footer>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-form">
          <span className="eyebrow">YOUR PERSONAL WORKSPACE</span>
          <h2 tabIndex={-1}>
            {register ? "A fresh start awaits." : "Welcome back."}
          </h2>
          <p className="muted">
            {register
              ? "Create your demo workspace and find your flow."
              : "A clear mind starts with a clear plan. Let’s get to it."}
          </p>
          <form onSubmit={submit} aria-busy={busy}>
            {register && (
              <label>
                Full name
                <input
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={80}
                  placeholder="Your name"
                />
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <div className="password-wrap">
                <input
                  name="password"
                  type={show ? "text" : "password"}
                  autoComplete={register ? "new-password" : "current-password"}
                  required
                  placeholder="Enter your password"
                  aria-describedby="password-help"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            <small id="password-help">
              {register
                ? "12+ characters, up to 72 UTF-8 bytes. Use a made-up password."
                : "Use the demo credentials below. No real account required."}
            </small>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary full" disabled={busy}>
              {busy ? <LoaderCircle size={18} className="spin" /> : null}
              {busy
                ? "Please wait…"
                : register
                  ? "Create demo account"
                  : "Sign in"}
              {!busy && <ArrowRight size={18} />}
            </button>
          </form>
          <p className="auth-switch">
            {register ? "Already exploring?" : "New to TaskFlow?"}{" "}
            <Link to={register ? "/login" : "/register"}>
              {register ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <aside className="demo-credentials">
            <span className="eyebrow">TAKE A LOOK AROUND</span>
            <p>
              Demo email: <strong>demo@taskflow.app</strong>
              <br />
              Demo password: <strong>TaskflowDemo!2026</strong>
            </p>
            <small>
              Simulated authentication only. Registration accepts any valid demo
              details and does not save passwords or create an account.
            </small>
          </aside>
        </div>
      </section>
    </main>
  );
}
function TaskForm({
  task,
  fail,
  onSave,
  onClose,
}: {
  task: Task | null;
  fail: boolean;
  onSave: (values: Pick<Task, "title" | "description" | "status">) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [failedOnce, setFailedOnce] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const title = String(data.get("title")).trim();
    if (!title) {
      setError("Give your task a title.");
      return;
    }
    setBusy(true);
    await pause();
    if (fail && !failedOnce) {
      setFailedOnce(true);
      setError(
        "Demo save failed. Your changes are safe here. Try saving again.",
      );
      setBusy(false);
      return;
    }
    onSave({
      title,
      description: String(data.get("description")).trim(),
      status: data.get("status") as Status,
    });
  }
  return (
    <form onSubmit={submit} aria-busy={busy}>
      <label>
        Task title
        <input
          name="title"
          required
          maxLength={120}
          defaultValue={task?.title}
          placeholder="What would you like to accomplish?"
          autoFocus
          data-initial-focus
        />
      </label>
      <label>
        Description <span className="optional">(optional)</span>
        <textarea
          name="description"
          maxLength={2000}
          defaultValue={task?.description}
          placeholder="Add a little context…"
          rows={4}
        />
      </label>
      <label>
        Status
        <select name="status" defaultValue={task?.status ?? "pending"}>
          {Object.entries(labels).map(([s, l]) => (
            <option key={s} value={s}>
              {l}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button
          type="button"
          className="secondary"
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </button>
        <button className="primary" disabled={busy}>
          {busy ? "Saving…" : task ? "Save changes" : "Create task"}
        </button>
      </div>
    </form>
  );
}
function Dashboard({ name, logout }: { name: string; logout: () => void }) {
  const [tasks, setTasks] = useState(seedTasks),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [page, setPage] = useState(1);
  const [mode, setMode] = useState<"ready" | "loading" | "error">("ready"),
    [notice, setNotice] = useState(""),
    [editing, setEditing] = useState<Task | null | undefined>(undefined),
    [deleting, setDeleting] = useState<Task | null>(null),
    [pending, setPending] = useState(false),
    [fail, setFail] = useState(false),
    [deleteError, setDeleteError] = useState("");
  const filtered = filterTasks(tasks, query, status),
    pages = Math.max(1, Math.ceil(filtered.length / 6)),
    currentPage = Math.min(page, pages),
    visible = filtered.slice((currentPage - 1) * 6, currentPage * 6);
  const complete = tasks.filter((t) => t.status === "completed").length,
    percentage = tasks.length ? Math.round((complete / tasks.length) * 100) : 0;
  const summaries = [
    {
      label: "Total tasks",
      value: tasks.length,
      icon: Layers,
      color: "indigo",
    },
    {
      label: "Pending",
      value: tasks.filter((t) => t.status === "pending").length,
      icon: Circle,
      color: "amber",
    },
    {
      label: "In progress",
      value: tasks.filter((t) => t.status === "in-progress").length,
      icon: LoaderCircle,
      color: "blue",
    },
    { label: "Completed", value: complete, icon: CircleCheck, color: "green" },
  ];
  async function reload() {
    setMode("loading");
    await pause();
    setMode("ready");
  }
  async function toggle(task: Task) {
    setPending(true);
    await pause();
    if (fail) {
      setNotice(
        "Demo update failed. Task unchanged. Turn off failure simulation to retry.",
      );
    } else {
      setTasks((ts) =>
        ts.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: t.status === "completed" ? "pending" : "completed",
                updatedAt: new Date().toISOString(),
              }
            : t,
        ),
      );
      setNotice(
        task.status === "completed"
          ? "Task marked incomplete."
          : "Task completed. A little win worth celebrating.",
      );
    }
    setPending(false);
  }
  async function remove() {
    if (!deleting) return;
    setPending(true);
    await pause();
    if (fail) {
      setDeleteError(
        "Demo deletion failed. Your task is still here. Turn off failure simulation, or cancel and try again.",
      );
      setPending(false);
      return;
    }
    setTasks((ts) => ts.filter((t) => t.id !== deleting.id));
    setDeleting(null);
    setPending(false);
    setNotice("Task deleted.");
  }
  function reset(empty = false) {
    setTasks(empty ? [] : seedTasks());
    setQuery("");
    setStatus("all");
    setPage(1);
    setMode("ready");
    setNotice(
      empty ? "Empty workspace demo loaded." : "Sample workspace restored.",
    );
  }
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <Brand />
          <span className="workspace-label">Personal workspace</span>
          <div className="account">
            <span className="avatar">{name.slice(0, 1).toUpperCase()}</span>
            <span className="account-name">{name}</span>
            <ActionButton label="Log out" tooltip="Log out" onClick={logout}>
              <LogOut size={18} />
            </ActionButton>
          </div>
        </div>
      </header>
      <main className="dashboard">
        <div className="page-heading">
          <div>
            <div className="eyebrow">A LITTLE FOCUS GOES A LONG WAY</div>
            <h1 tabIndex={-1}>Let’s make progress, {name.split(" ")[0]}.</h1>
            <p className="muted">
              Your plans, your pace. Here’s what’s on your plate.
            </p>
          </div>
          <button className="primary" onClick={() => setEditing(null)}>
            <Plus size={18} />
            New task
          </button>
        </div>
        <section className="summary-grid" aria-label="Task summary">
          {summaries.map(({ label, value, icon: Icon, color }) => (
            <div className="summary-card" key={label}>
              <div className={`summary-icon ${color}`}>
                <Icon size={21} />
              </div>
              <div>
                <span className="summary-label">{label}</span>
                <strong>{value.toString().padStart(2, "0")}</strong>
              </div>
            </div>
          ))}
        </section>
        <section className="progress-banner">
          <span className="progress-symbol">
            <CheckCheck size={26} />
          </span>
          <div className="progress-copy">
            <strong>
              {percentage === 100
                ? "You’ve cleared your plate. Nicely done!"
                : "Small steps. Real progress."}
            </strong>
            <p>
              {complete} of {tasks.length} tasks complete.{" "}
              {percentage === 100
                ? "Enjoy a moment of clarity."
                : "Keep the momentum going."}
            </p>
          </div>
          <div className="progress-track">
            <span>{percentage}% complete</span>
            <div
              role="progressbar"
              aria-label="Task completion"
              aria-valuenow={percentage}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <i style={{ width: `${percentage}%` }} />
            </div>
          </div>
        </section>
        <section className="tasks-panel" aria-labelledby="tasks-heading">
          <div className="task-panel-heading">
            <h2 id="tasks-heading">
              Your tasks <span>{tasks.length}</span>
            </h2>
            <span className="muted text-sm">A clearer view of what’s next</span>
          </div>
          <div className="toolbar">
            <label className="search-field">
              <Search size={18} />
              <span className="sr-only">Search tasks</span>
              <input
                placeholder="Search by task title…"
                maxLength={120}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <div className="filter-field">
              <SlidersHorizontal size={17} />
              <label className="sr-only" htmlFor="status-filter">
                Filter by status
              </label>
              <select
                id="status-filter"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All statuses</option>
                {Object.entries(labels).map(([s, l]) => (
                  <option value={s} key={s}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="sr-only" role="status">
            {filtered.length} matching tasks
          </p>
          {mode === "loading" ? (
            <div className="state-panel" role="status">
              <LoaderCircle className="spin" size={32} />
              <h3>Finding your flow…</h3>
              <p>Loading your tasks.</p>
            </div>
          ) : mode === "error" ? (
            <div className="state-panel" role="alert">
              <AlertCircle size={32} />
              <h3>A small bump in the road.</h3>
              <p>We couldn’t load your tasks. Your work hasn’t changed.</p>
              <button className="primary" onClick={reload}>
                Try again
              </button>
            </div>
          ) : visible.length === 0 ? (
            <div className="state-panel">
              <ClipboardList size={36} />
              <h3>
                {tasks.length
                  ? "No tasks match just yet."
                  : "A clear space. A fresh start."}
              </h3>
              <p>
                {tasks.length
                  ? "Try another title or clear your filters."
                  : "Turn your next idea into your first task."}
              </p>
              <button
                className="primary"
                onClick={() =>
                  tasks.length
                    ? (setQuery(""), setStatus("all"))
                    : setEditing(null)
                }
              >
                {tasks.length
                  ? "Clear search and filters"
                  : "Create your first task"}
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <>
              <div className="list-heading">
                <span>TASK</span>
                <span>STATUS</span>
                <span>ACTIONS</span>
              </div>
              <ul className="task-list">
                {visible.map((task) => (
                  <li
                    key={task.id}
                    className={
                      task.status === "completed" ? "task-row done" : "task-row"
                    }
                  >
                    <button
                      className="complete-button"
                      aria-label={`${task.status === "completed" ? "Mark incomplete" : "Mark complete"}: ${task.title}`}
                      aria-pressed={task.status === "completed"}
                      onClick={() => toggle(task)}
                      disabled={pending}
                    >
                      {task.status === "completed" ? (
                        <CircleCheck size={23} />
                      ) : (
                        <Circle size={23} />
                      )}
                    </button>
                    <div className="task-copy">
                      <h3>{task.title}</h3>
                      <p>{task.description}</p>
                      <small>
                        Created{" "}
                        {new Date(task.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}{" "}
                        · Updated{" "}
                        {new Date(task.updatedAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </small>
                    </div>
                    <span className={`status-badge ${task.status}`}>
                      <i />
                      {labels[task.status]}
                    </span>
                    <div className="row-actions">
                      <ActionButton
                        label={`Edit: ${task.title}`}
                        tooltip="Edit task"
                        onClick={() => setEditing(task)}
                      >
                        <Pencil size={17} />
                      </ActionButton>
                      <ActionButton
                        destructive
                        tooltip="Delete task"
                        label={`Delete: ${task.title}`}
                        onClick={() => {
                          setDeleteError("");
                          setDeleting(task);
                        }}
                      >
                        <Trash2 size={17} />
                      </ActionButton>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="pagination">
                <span>
                  Showing {(currentPage - 1) * 6 + 1}–
                  {Math.min(currentPage * 6, filtered.length)} of{" "}
                  {filtered.length} tasks
                </span>
                <div>
                  <button
                    className="secondary"
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    {currentPage} / {pages}
                  </span>
                  <button
                    className="secondary"
                    disabled={currentPage === pages}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
        <details className="demo-controls">
          <summary>
            Prototype playground{" "}
            <span>
              Explore interface states <ArrowUpRight size={14} />
            </span>
          </summary>
          <div className="demo-options">
            <button className="secondary" onClick={() => reset()}>
              Reset sample data
            </button>
            <button className="secondary" onClick={() => reset(true)}>
              Empty workspace
            </button>
            <button className="secondary" onClick={() => setMode("loading")}>
              Show loading
            </button>
            <button className="secondary" onClick={() => setMode("error")}>
              Show load error
            </button>
            <button className="secondary" onClick={reload}>
              Return to tasks
            </button>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={fail}
                onChange={(e) => setFail(e.target.checked)}
              />
              Simulate mutation failures
            </label>
          </div>
        </details>
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
          onClose={() => setEditing(undefined)}
        >
          <TaskForm
            task={editing}
            fail={fail}
            onClose={() => setEditing(undefined)}
            onSave={(values) => {
              const now = new Date().toISOString();
              setTasks((ts) =>
                editing
                  ? ts.map((t) =>
                      t.id === editing.id
                        ? { ...t, ...values, updatedAt: now }
                        : t,
                    )
                  : [
                      {
                        ...values,
                        id: crypto.randomUUID(),
                        createdAt: now,
                        updatedAt: now,
                      },
                      ...ts,
                    ],
              );
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
          onClose={() => {
            if (!pending) setDeleting(null);
          }}
        >
          <p className="delete-copy">
            “{deleting.title}” will be removed from this demo workspace. This
            can’t be undone.
          </p>
          {deleteError && (
            <p className="error" role="alert">
              {deleteError}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="secondary"
              autoFocus
              data-initial-focus
              disabled={pending}
              onClick={() => setDeleting(null)}
            >
              Keep task
            </button>
            <button className="danger" disabled={pending} onClick={remove}>
              {pending ? "Deleting…" : "Delete task"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
export default function App() {
  const [user, setUser] = useState<string | null>(null);
  const navigate = useNavigate(),
    location = useLocation();
  useEffect(() => {
    document.querySelector<HTMLElement>(".auth-form h2, h1")?.focus();
  }, [location.pathname]);
  return (
    <>
      <div className="demo-banner">
        PROTOTYPE{" "}
        <span>
          Demo — mock data; changes reset on reload. Please don’t enter real
          credentials.
        </span>
      </div>
      <Routes>
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Auth
                key="login"
                register={false}
                onLogin={(name) => {
                  setUser(name);
                  navigate("/dashboard");
                }}
              />
            )
          }
        />
        <Route
          path="/register"
          element={
            user ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Auth
                key="register"
                register
                onLogin={(name) => {
                  setUser(name);
                  navigate("/dashboard");
                }}
              />
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            user ? (
              <Dashboard
                name={user}
                logout={() => {
                  setUser(null);
                  navigate("/login", { replace: true });
                }}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="*"
          element={<Navigate to={user ? "/dashboard" : "/login"} replace />}
        />
      </Routes>
    </>
  );
}
