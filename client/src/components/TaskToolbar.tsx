import { Search, SlidersHorizontal } from "lucide-react";
import { statusLabels } from "../api/contracts";
import type { TaskStatus } from "../api/contracts";
export function TaskToolbar({
  query,
  status,
  onQuery,
  onStatus,
}: {
  query: string;
  status: TaskStatus | "all";
  onQuery: (value: string) => void;
  onStatus: (value: TaskStatus | "all") => void;
}) {
  return (
    <div className="toolbar">
      <label className="search-field">
        <Search size={18} />
        <span className="sr-only">Search tasks</span>
        <input
          placeholder="Search by task title…"
          maxLength={120}
          value={query}
          onChange={(e) => {
            onQuery(e.target.value);
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
            onStatus(e.target.value as TaskStatus | "all");
          }}
        >
          <option value="all">All statuses</option>
          {Object.entries(statusLabels).map(([s, l]) => (
            <option value={s} key={s}>
              {l}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
