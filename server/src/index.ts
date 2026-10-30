import { parseStartupEnv } from "./config/env.js";
import { startServer } from "./start.js";

async function main() {
  let env;
  try {
    env = parseStartupEnv(process.env);
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Invalid environment configuration.",
    );
    process.exitCode = 1;
    return;
  }
  try {
    const runtime = await startServer(env);
    if (runtime)
      console.info(`TaskFlow API listening on ${env.HOST}:${env.PORT}`);
  } catch {
    console.error(
      "Server startup failed. Check database connectivity and configuration.",
    );
    process.exitCode = 1;
  }
}
void main();
