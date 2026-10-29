import express from "express";
import helmet from "helmet";
import { errorHandler, notFound } from "./middleware/errors.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "16kb" }));
  app.get("/api/health", (_req, res) => {
    res.set("Cache-Control", "no-store").status(200).json({ status: "ok" });
  });
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
