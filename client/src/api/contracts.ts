export const TASK_STATUSES = ["todo", "in_progress", "completed"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type User = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};
export type Task = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
};
export type LoginInput = { email: string; password: string };
export type RegisterInput = LoginInput & { name: string };
export type CreateTaskInput = {
  title: string;
  description?: string;
  status?: TaskStatus;
};
export type TaskValues = Required<CreateTaskInput>;
export type UpdateTaskInput = Partial<TaskValues>;
export type TaskQuery = {
  q?: string;
  status?: TaskStatus;
  page?: number;
  limit?: number;
};
export type UserResponse = { data: { user: User } };
export type TaskResponse = { data: { task: Task } };
export type TaskListResponse = {
  data: { tasks: Task[] };
  meta: { page: number; limit: number; total: number; totalPages: number };
};
export type ErrorResponse = {
  error: { code: string; message: string; fields?: Record<string, string[]> };
};
export const statusLabels: Record<TaskStatus, string> = {
  todo: "Pending",
  in_progress: "In progress",
  completed: "Completed",
};
