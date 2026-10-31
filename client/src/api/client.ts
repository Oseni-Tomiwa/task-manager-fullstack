import type {
  CreateTaskInput,
  ErrorResponse,
  LoginInput,
  RegisterInput,
  TaskListResponse,
  TaskQuery,
  TaskResponse,
  TaskSummaryResponse,
  UpdateTaskInput,
  UserResponse,
} from "./contracts";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
const fallback = "We couldn’t complete that request. Please try again.";
// Same-origin paths only: cookies stay on the frontend origin.
export function createApiClient(
  base = import.meta.env.VITE_API_BASE_URL || "/api",
  transport: typeof fetch = fetch,
  onUnauthorized?: () => void,
) {
  if (!/^\/(?!\/)[a-zA-Z0-9/_-]+$/.test(base))
    throw new Error("API base must be a same-origin path.");
  const root = base.replace(/\/$/, "");
  async function send<T>(
    path: string,
    method = "GET",
    body?: object,
    signal?: AbortSignal,
  ): Promise<T> {
    let response: Response;
    try {
      response = await transport(`${root}${path}`, {
        method,
        credentials: "same-origin",
        cache: "no-store",
        signal,
        headers:
          method === "GET"
            ? {}
            : { "Content-Type": "application/json", "X-TaskFlow-Request": "1" },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        error.name === "AbortError"
      )
        throw error;
      throw new ApiError(
        0,
        "NETWORK_ERROR",
        "We couldn’t reach TaskFlow. Check your connection and try again.",
      );
    }
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (
      response.status === 401 &&
      (path.startsWith("/tasks") || path === "/auth/logout")
    )
      onUnauthorized?.();
    if (response.status === 204) return undefined as T;
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ApiError(response.status, "INVALID_RESPONSE", fallback);
    }
    if (!response.ok) {
      const error = (payload as Partial<ErrorResponse> | null)?.error;
      if (
        error &&
        typeof error.code === "string" &&
        typeof error.message === "string"
      ) {
        throw new ApiError(
          response.status,
          error.code,
          error.message,
          error.fields,
        );
      }
      throw new ApiError(response.status, "REQUEST_FAILED", fallback);
    }
    return payload as T;
  }
  return {
    register: (input: RegisterInput) =>
      send<UserResponse>("/auth/register", "POST", input),
    login: (input: LoginInput) =>
      send<UserResponse>("/auth/login", "POST", input),
    me: (signal?: AbortSignal) =>
      send<UserResponse>("/auth/me", "GET", undefined, signal),
    logout: () => send<void>("/auth/logout", "POST", {}),
    listTasks: (query: TaskQuery = {}, signal?: AbortSignal) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query))
        if (value !== undefined && value !== "") params.set(key, String(value));
      return send<TaskListResponse>(
        `/tasks${params.size ? `?${params}` : ""}`,
        "GET",
        undefined,
        signal,
      );
    },
    summary: (signal?: AbortSignal) =>
      send<TaskSummaryResponse>("/tasks/summary", "GET", undefined, signal),
    getTask: (id: string, signal?: AbortSignal) =>
      send<TaskResponse>(
        `/tasks/${encodeURIComponent(id)}`,
        "GET",
        undefined,
        signal,
      ),
    createTask: (input: CreateTaskInput) =>
      send<TaskResponse>("/tasks", "POST", input),
    updateTask: (id: string, input: UpdateTaskInput) =>
      send<TaskResponse>(`/tasks/${encodeURIComponent(id)}`, "PATCH", input),
    deleteTask: (id: string) =>
      send<void>(`/tasks/${encodeURIComponent(id)}`, "DELETE", {}),
  };
}
