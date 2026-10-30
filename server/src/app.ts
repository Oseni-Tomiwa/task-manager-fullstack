import express from "express";
import helmet from "helmet";
import { authRouter } from "./auth/routes.js";
import type { AuthConfig } from "./config/auth.js";
import { errorHandler, notFound } from "./middleware/errors.js";

export function createApp(authConfig?: AuthConfig) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use("/api/auth", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "16kb" }));
  app.get("/api/health", (_req, res) => {
    res.set("Cache-Control", "no-store").status(200).json({ status: "ok" });
  });
  if (authConfig) app.use("/api/auth", authRouter(authConfig));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
