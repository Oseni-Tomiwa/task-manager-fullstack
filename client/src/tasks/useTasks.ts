import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { createApiClient } from "../api/client";
import type {
  Task,
  TaskCounts,
  TaskListResponse,
  TaskStatus,
  TaskValues,
} from "../api/contracts";

type Mode = "loading" | "ready" | "error";
type PageState = { key: string; mode: Mode; result?: TaskListResponse };
type SummaryState = { key: number; mode: Mode; counts?: TaskCounts };
export const PAGE_SIZE = 6;
export function useTasks(
  api: ReturnType<typeof createApiClient>,
  query: string,
  status: TaskStatus | "all",
  page: number,
  setPage: Dispatch<SetStateAction<number>>,
) {
  const [revision, setRevision] = useState(0);
  const [summaryRetry, setSummaryRetry] = useState(0);
  const [list, setList] = useState<PageState>({ key: "", mode: "loading" });
  const [summary, setSummary] = useState<SummaryState>({
    key: -1,
    mode: "loading",
  });
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const mounted = useRef(false);
  const lastQuery = useRef(query.trim());
  const q = query.trim();
  const key = JSON.stringify([q, status, page, revision]);
  const summaryKey = revision + summaryRetry;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const searchChanged = lastQuery.current !== q;
    lastQuery.current = q;
    const timer = setTimeout(
      () => {
        void api
          .listTasks(
            {
              q: q || undefined,
              status: status === "all" ? undefined : status,
              page,
              limit: PAGE_SIZE,
            },
            controller.signal,
          )
          .then((result) => {
            if (controller.signal.aborted) return;
            const lastPage = Math.max(1, result.meta.totalPages);
            if (page > lastPage) {
              setPage(lastPage);
              return;
            }
            setList({ key, mode: "ready", result });
          })
          .catch(() => {
            if (!controller.signal.aborted)
              setList((previous) => ({
                key,
                mode: "error",
                result: previous.result,
              }));
          });
      },
      searchChanged && q ? 300 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [api, q, status, page, revision, key, setPage]);
  useEffect(() => {
    const controller = new AbortController();
    void api
      .summary(controller.signal)
      .then(({ data }) => {
        if (!controller.signal.aborted)
          setSummary({ key: summaryKey, mode: "ready", counts: data.summary });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setSummary({ key: summaryKey, mode: "error" });
      });
    return () => controller.abort();
  }, [api, summaryKey]);
  async function mutate(action: () => Promise<unknown>) {
    if (locked.current)
      throw new Error("A task change is already being saved. Please wait.");
    locked.current = true;
    setBusy(true);
    try {
      await action();
      // The write is complete. Refresh is a separate read lifecycle, never a write failure.
      if (mounted.current) setRevision((previous) => previous + 1);
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const current = list.key === key;
  const currentSummary = summary.key === summaryKey;
  return {
    tasks: current && list.mode === "ready" ? list.result!.data.tasks : [],
    meta: current && list.mode === "ready" ? list.result!.meta : undefined,
    mode: current ? list.mode : ("loading" as Mode),
    counts:
      currentSummary && summary.mode === "ready" ? summary.counts : undefined,
    summaryMode: currentSummary ? summary.mode : ("loading" as Mode),
    busy,
    hasLoaded: Boolean(list.result),
    reload: () => setRevision((previous) => previous + 1),
    retrySummary: () => setSummaryRetry((previous) => previous + 1),
    save: (task: Task | null, values: TaskValues) =>
      mutate(() =>
        task ? api.updateTask(task.id, values) : api.createTask(values),
      ),
    toggle: (task: Task) =>
      mutate(() =>
        api.updateTask(task.id, {
          status: task.status === "completed" ? "todo" : "completed",
        }),
      ),
    remove: (task: Task) => mutate(() => api.deleteTask(task.id)),
  };
}
