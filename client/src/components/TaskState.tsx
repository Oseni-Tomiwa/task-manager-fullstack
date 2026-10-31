import {
  AlertCircle,
  ArrowRight,
  ClipboardList,
  LoaderCircle,
} from "lucide-react";
export function TaskState({
  mode,
  hasTasks,
  onRetry,
  onClear,
  onCreate,
}: {
  mode: "loading" | "error" | "empty";
  hasTasks: boolean;
  onRetry: () => void;
  onClear: () => void;
  onCreate: () => void;
}) {
  if (mode === "loading")
    return (
      <div className="state-panel" role="status">
        <LoaderCircle className="spin" size={32} />
        <h3>Finding your flow…</h3>
        <p>Loading your tasks.</p>
      </div>
    );
  if (mode === "error")
    return (
      <div className="state-panel" role="alert">
        <AlertCircle size={32} />
        <h3>A small bump in the road.</h3>
        <p>We couldn’t load your tasks. Your work hasn’t changed.</p>
        <button className="primary" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  return (
    <div className="state-panel">
      <ClipboardList size={36} />
      <h3>
        {hasTasks
          ? "No tasks match just yet."
          : "A clear space. A fresh start."}
      </h3>
      <p>
        {hasTasks
          ? "Try another title or clear your filters."
          : "Turn your next idea into your first task."}
      </p>
      <button className="primary" onClick={hasTasks ? onClear : onCreate}>
        {hasTasks ? "Clear search and filters" : "Create your first task"}
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
