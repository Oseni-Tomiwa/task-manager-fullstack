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
export const User =
  (mongoose.models.User as Model<UserRecord> | undefined) ??
  mongoose.model<UserRecord>("User", userSchema);
