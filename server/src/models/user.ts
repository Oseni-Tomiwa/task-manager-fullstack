import { recordStartup } from "../startup-diagnostics.js";
import mongoose from "mongoose";
import type { Model } from "mongoose";
import { z } from "zod";

export interface UserRecord {
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new mongoose.Schema<UserRecord>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      validate: {
        validator: (value: string) => z.email().safeParse(value).success,
        message: "Email is invalid.",
      },
    },
    passwordHash: {
      type: String,
      required: true,
      minlength: 1,
      maxlength: 255,
      select: false,
    },
  },
  {
    timestamps: true,
    strict: "throw",
    bufferCommands: false,
    toJSON: {
      transform: (_doc, result) => {
        Reflect.deleteProperty(result, "passwordHash");
        return result;
      },
    },
  },
);
userSchema.index({ email: 1 }, { unique: true });
// Register before model compilation: Mongoose may start init automatically.
userSchema.pre("createCollection", function () {
  recordStartup("user_collection", "started");
});
userSchema.post("createCollection", function () {
  recordStartup("user_collection", "ok");
});
userSchema.post(
  "createCollection",
  function (error: Error, _collection: unknown, next: (error?: Error) => void) {
    recordStartup("user_collection", "failed", error);
    next(error);
  },
);
const observedModels = new WeakSet<Model<UserRecord>>();
userSchema.on("init", (model: Model<UserRecord>) => {
  if (observedModels.has(model)) return;
  observedModels.add(model);
  // This schema declares only the unique email index. Ignore event payloads
  // containing fields, options, or generated index names.
  model.on("index-single-start", () =>
    recordStartup("user_email_index", "started"),
  );
  model.on("index-single-done", (error: unknown) => {
    recordStartup("user_email_index", error == null ? "ok" : "failed", error);
  });
});
export const User =
  (mongoose.models.User as Model<UserRecord> | undefined) ??
  mongoose.model<UserRecord>("User", userSchema);
