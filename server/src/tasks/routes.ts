import { Router } from "express";
import type { Types } from "mongoose";
import type { AuthConfig } from "../config/auth.js";
import { requireAuth, csrfProtection } from "../auth/middleware.js";
import { Task } from "../models/task.js";
import type { TaskRecord } from "../models/task.js";
import {
  createTaskSchema,
  updateTaskSchema,
  taskIdSchema,
  taskQuerySchema,
  escapeSearch,
} from "./validation.js";

function publicTask(task: TaskRecord & { _id: Types.ObjectId }) {
  return {
    id: task._id.toString(),
    title: task.title,
    description: task.description,
    status: task.status,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}
const notFound = {
  error: { code: "TASK_NOT_FOUND", message: "Task not found." },
};
const invalid = {
  error: {
    code: "VALIDATION_ERROR",
    message: "Check the supplied task fields or query parameters.",
  },
};
export function taskRouter(config: AuthConfig) {
  const router = Router();
  router.use(requireAuth(config));
  router.use(csrfProtection(config));
  router.post("/", async (req, res) => {
    const result = createTaskSchema.safeParse(req.body);
    if (!result.success || Object.keys(req.query).length) {
      res.status(400).json(invalid);
      return;
    }
    const task = await Task.create({ ...result.data, owner: req.user!.id });
    res.status(201).json({ data: { task: publicTask(task) } });
  });
  router.get("/", async (req, res) => {
    const result = taskQuerySchema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json(invalid);
      return;
    }
    const { q, status, page, limit } = result.data;
    const filter = {
      owner: req.user!.id,
      ...(status ? { status } : {}),
      ...(q ? { title: { $regex: escapeSearch(q), $options: "i" } } : {}),
    };
    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Task.countDocuments(filter),
    ]);
    res.status(200).json({
      data: { tasks: tasks.map(publicTask) },
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });
  router.use("/:id", (req, res, next) => {
    if (
      !taskIdSchema.safeParse(req.params.id).success ||
      Object.keys(req.query).length
    ) {
      res.status(400).json(invalid);
      return;
    }
    next();
  });
  router.get("/:id", async (req, res) => {
    const task = await Task.findOne({
      _id: req.params.id,
      owner: req.user!.id,
    });
    if (!task) {
      res.status(404).json(notFound);
      return;
    }
    res.status(200).json({ data: { task: publicTask(task) } });
  });
  router.patch("/:id", async (req, res) => {
    const result = updateTaskSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json(invalid);
      return;
    }
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, owner: req.user!.id },
      { $set: result.data },
      { returnDocument: "after", runValidators: true },
    );
    if (!task) {
      res.status(404).json(notFound);
      return;
    }
    res.status(200).json({ data: { task: publicTask(task) } });
  });
  router.delete("/:id", async (req, res) => {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      owner: req.user!.id,
    });
    if (!task) {
      res.status(404).json(notFound);
      return;
    }
    res.status(204).end();
  });
  return router;
}
