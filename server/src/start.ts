import type { Server } from "node:http";
import { createApp } from "./app.js";
import type { StartupEnv } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./database/connection.js";
import { User } from "./models/user.js";

export async function startServer(env: StartupEnv, app = createApp()) {
  let server: Server | undefined;
  let stopping = false;
  let closing: Promise<void> | undefined;
  const onSignal = () => {
    void shutdown().catch(() => {
      console.error("Server shutdown failed.");
      process.exitCode = 1;
    });
  };
  function shutdown(): Promise<void> {
    if (closing) return closing;
    stopping = true;
    closing = (async () => {
      const deadline = setTimeout(() => {
        console.error("Shutdown deadline exceeded.");
        server?.closeAllConnections();
        process.exit(1);
      }, 10_000);
      deadline.unref();
      try {
        try {
          if (server?.listening) {
            await new Promise<void>((resolve, reject) => {
              server!.close((error) =>
                error ? reject(new Error("HTTP cleanup failed.")) : resolve(),
              );
            });
          }
        } finally {
          await disconnectDatabase();
        }
      } finally {
        clearTimeout(deadline);
        process.off("SIGTERM", onSignal);
        process.off("SIGINT", onSignal);
      }
    })();
    return closing;
  }
  process.on("SIGTERM", onSignal);
  process.on("SIGINT", onSignal);
  try {
    await connectDatabase(env.MONGODB_URI);
    if (stopping) {
      await shutdown();
      return;
    }
    // Wait for the email unique index before accepting future writes.
    await User.init();
    if (stopping) {
      await shutdown();
      return;
    }
    await new Promise<void>((resolve, reject) => {
      server = app.listen(env.PORT, env.HOST);
      server.once("error", reject);
      server.once("listening", () => {
        server!.off("error", reject);
        resolve();
      });
    });
    server!.on("error", () => {
      console.error("HTTP server encountered an error.");
      process.exitCode = 1;
      onSignal();
    });
    return { server: server!, shutdown };
  } catch {
    await shutdown().catch(() => undefined);
    throw new Error("Server startup failed.");
  }
}
