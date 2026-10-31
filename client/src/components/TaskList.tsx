import { Circle, CircleCheck, Pencil, Trash2 } from "lucide-react";
import { statusLabels } from "../api/contracts";
import type { Task } from "../api/contracts";
import { ActionButton } from "./ActionButton";
export function TaskList({
  tasks,
  busy,
  onToggle,
  onEdit,
  onDelete,
}: {
  tasks: Task[];
  busy: boolean;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  return (
    <>
      <div className="list-heading">
        <span>TASK</span>
        <span>STATUS</span>
        <span>ACTIONS</span>
      </div>
      <ul className="task-list" aria-label="Tasks">
        {tasks.map((task) => (
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
              onClick={() => onToggle(task)}
              disabled={busy}
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
              {statusLabels[task.status]}
            </span>
            <div className="row-actions">
              <ActionButton
                disabled={busy}
                label={`Edit: ${task.title}`}
                tooltip="Edit task"
                onClick={() => onEdit(task)}
              >
                <Pencil size={17} />
              </ActionButton>
              <ActionButton
                disabled={busy}
                destructive
                tooltip="Delete task"
                label={`Delete: ${task.title}`}
                onClick={() => {
                  onDelete(task);
                }}
              >
                <Trash2 size={17} />
              </ActionButton>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
