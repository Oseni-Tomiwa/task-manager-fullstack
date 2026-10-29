import { createApp } from "./app.js";
import { parseEnv } from "./config/env.js";
import type { Env } from "./config/env.js";

function main() {
  let env: Env;
  try {
    env = parseEnv(process.env);
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Invalid environment configuration.",
    );
    process.exitCode = 1;
    return;
  }
  const server = createApp().listen(env.PORT, env.HOST, () => {
    console.info(`TaskFlow API listening on ${env.HOST}:${env.PORT}`);
  });
  server.on("error", () => {
    console.error("HTTP server failed to start or encountered a server error.");
    process.exitCode = 1;
  });
  let stopping = false;
  const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.info(`${signal} received; closing HTTP server.`);
    const timeout = setTimeout(() => {
      console.error(
        "Shutdown deadline exceeded; closing remaining connections.",
      );
      process.exitCode = 1;
      server.closeAllConnections();
    }, 10_000);
    timeout.unref();
    server.close((error) => {
      clearTimeout(timeout);
      if (error) {
        console.error("HTTP server shutdown failed.");
        process.exitCode = 1;
      }
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
main();
