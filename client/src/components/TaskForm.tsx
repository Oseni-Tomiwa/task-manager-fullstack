import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { statusLabels } from "../api/contracts";
import type { Task, TaskValues } from "../api/contracts";
import { validateTask } from "../validation";
import type { FieldErrors } from "../validation";
import { FieldError } from "./FieldError";
export function TaskForm({
  task,
  busy,
  onSave,
  onClose,
}: {
  task: Task | null;
  busy: boolean;
  onSave: (values: TaskValues) => Promise<void>;
  onClose: () => void;
}) {
  const pending = useRef(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || pending.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const values = {
      title: String(data.get("title") ?? "").trim(),
      description: String(data.get("description") ?? "").trim(),
      status: String(data.get("status") ?? "todo"),
    };
    const nextErrors = validateTask(values);
    setErrors(nextErrors);
    setError("");
    if (Object.keys(nextErrors).length) {
      form
        .querySelector<HTMLElement>(`[name="${Object.keys(nextErrors)[0]}"]`)
        ?.focus();
      return;
    }
    pending.current = true;
    try {
      await onSave(values as TaskValues);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "We couldn’t save your task. Please try again.",
      );
    } finally {
      pending.current = false;
    }
  }
  return (
    <form onSubmit={submit} aria-busy={busy} noValidate>
      <label>
        Task title
        <input
          name="title"
          required
          maxLength={120}
          defaultValue={task?.title}
          placeholder="What would you like to accomplish?"
          data-initial-focus
          aria-invalid={Boolean(errors.title)}
          aria-describedby="title-error"
        />
      </label>
      <FieldError id="title-error" message={errors.title} />
      <label>
        Description <span className="optional">(optional)</span>
        <textarea
          name="description"
          maxLength={2000}
          defaultValue={task?.description}
          placeholder="Add a little context…"
          rows={4}
          aria-invalid={Boolean(errors.description)}
          aria-describedby="description-error"
        />
      </label>
      <FieldError id="description-error" message={errors.description} />
      <label>
        Status
        <select
          name="status"
          defaultValue={task?.status ?? "todo"}
          aria-invalid={Boolean(errors.status)}
          aria-describedby="status-error"
        >
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <FieldError id="status-error" message={errors.status} />
      {error && (
        <p className="error" role="alert">
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
