export type Status = "pending" | "in-progress" | "completed";
export type Task = {
  id: string;
  title: string;
  description: string;
  status: Status;
  createdAt: string;
  updatedAt: string;
};
export const labels: Record<Status, string> = {
  pending: "Pending",
  "in-progress": "In progress",
  completed: "Completed",
};
const titles = [
  "Map out the TaskFlow user journey",
  "Design the authentication screens",
  "Review dashboard accessibility",
  "Write the project documentation",
  "Polish the mobile task experience",
  "Review the API architecture",
  "Prepare prototype walkthrough",
  "Check form validation states",
  "Test search and status filters",
  "Review keyboard navigation",
  "Document deployment decisions",
  "Prepare the internship submission",
];
export function seedTasks(): Task[] {
  return titles.map((title, i) => ({
    id: `demo-${i}`,
    title,
    description: [
      "Keep the experience simple, clear and focused on what matters.",
      "Explore the details and capture decisions for the next milestone.",
      "Review the prototype with fresh eyes and note any improvements.",
    ][i % 3],
    status: (["in-progress", "pending", "completed"] as Status[])[i % 3],
    createdAt: new Date(Date.UTC(2026, 9, 29 - i)).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 9, 29 - i)).toISOString(),
  }));
}
export function filterTasks(tasks: Task[], q: string, status: string) {
  return tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(q.trim().toLowerCase()) &&
      (status === "all" || t.status === status),
  );
}
export const pause = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 500));
