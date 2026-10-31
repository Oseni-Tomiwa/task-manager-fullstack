import {
  CheckCheck,
  Circle,
  CircleCheck,
  Layers,
  LoaderCircle,
} from "lucide-react";
import type { TaskCounts } from "../api/contracts";
export function TaskSummary({ counts }: { counts: TaskCounts }) {
  const complete = counts.completed;
  const percentage = counts.total
    ? Math.round((complete / counts.total) * 100)
    : 0;
  const summaries = [
    {
      label: "Total tasks",
      value: counts.total,
      icon: Layers,
      color: "indigo",
    },
    {
      label: "Pending",
      value: counts.todo,
      icon: Circle,
      color: "amber",
    },
    {
      label: "In progress",
      value: counts.in_progress,
      icon: LoaderCircle,
      color: "blue",
    },
    { label: "Completed", value: complete, icon: CircleCheck, color: "green" },
  ];
  return (
    <>
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
            {complete} of {counts.total} tasks complete.{" "}
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
    </>
  );
}
