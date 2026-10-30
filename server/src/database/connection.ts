import mongoose from "mongoose";

let opening: Promise<void> | undefined;
let closing: Promise<void> | undefined;

export async function connectDatabase(uri: string): Promise<void> {
  if (closing) await closing;
  if (mongoose.connection.readyState === 1) return;
  if (!opening) {
    opening = (async () => {
      try {
        await mongoose.connect(uri, {
          serverSelectionTimeoutMS: 10_000,
          connectTimeoutMS: 10_000,
          socketTimeoutMS: 45_000,
          maxPoolSize: 10,
          bufferCommands: false,
          autoIndex: true,
        });
      } catch {
        await mongoose.disconnect().catch(() => undefined);
        throw new Error("Database connection failed.");
      } finally {
        opening = undefined;
      }
    })();
  }
  await opening;
}

export async function disconnectDatabase(): Promise<void> {
  if (!closing) {
    closing = (async () => {
      // An interrupted startup must settle before the pool can be closed.
      await opening?.catch(() => undefined);
      try {
        await mongoose.disconnect();
      } catch {
        throw new Error("Database cleanup failed.");
      } finally {
        closing = undefined;
      }
    })();
  }
  await closing;
}
