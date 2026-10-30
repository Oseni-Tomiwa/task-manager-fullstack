import mongoose from "mongoose";
import type { Model, Types } from "mongoose";
export const TASK_STATUSES = ["todo", "in_progress", "completed"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export interface TaskRecord {
  title: string;
  description: string;
  status: TaskStatus;
  owner: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
const taskSchema = new mongoose.Schema<TaskRecord>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120,
    },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    status: {
      type: String,
      required: true,
      enum: TASK_STATUSES,
      default: "todo",
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
  },
  { timestamps: true, strict: "throw", bufferCommands: false },
);
taskSchema.index({ owner: 1, createdAt: -1, _id: -1 });
export const Task =
  (mongoose.models.Task as Model<TaskRecord> | undefined) ??
  mongoose.model<TaskRecord>("Task", taskSchema);
