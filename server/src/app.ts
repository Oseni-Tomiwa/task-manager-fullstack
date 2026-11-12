import { createProxyObserver } from "./diagnostics/proxy-observer.js";
import express from "express";
import helmet from "helmet";
import { authRouter } from "./auth/routes.js";
import { taskRouter } from "./tasks/routes.js";
import type { AuthConfig } from "./config/auth.js";
import { errorHandler, notFound } from "./middleware/errors.js";

export function createApp(authConfig?: AuthConfig) {
  const app = express();
  const observeProxy = createProxyObserver();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(["/api/auth", "/api/tasks"], (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "16kb" }));
  app.get("/api/health", (req, res) => {
    observeProxy(req);
    res.set("Cache-Control", "no-store").status(200).json({ status: "ok" });
  });
  if (authConfig) {
    app.use("/api/auth", authRouter(authConfig));
    app.use("/api/tasks", taskRouter(authConfig));
  }
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
