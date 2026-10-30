import type { RequestHandler } from "express";
import type { AuthConfig } from "../config/auth.js";
import { User } from "../models/user.js";
import { clearSession, publicUser, sessionSubject } from "./session.js";
import type { PublicUser } from "./session.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express supports request identity through this global namespace.
  namespace Express {
    interface Request {
      user?: PublicUser;
    }
  }
}
export function csrfProtection(config: AuthConfig): RequestHandler {
  return (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      next();
      return;
    }
    if (
      req.get("Origin") !== config.CLIENT_ORIGIN ||
      req.get("X-TaskFlow-Request") !== "1"
    ) {
      res.status(403).json({
        error: {
          code: "CSRF_REJECTED",
          message: "Request origin or security header is invalid.",
        },
      });
      return;
    }
    if (!req.is("application/json")) {
      res.status(415).json({
        error: { code: "JSON_REQUIRED", message: "Use application/json." },
      });
      return;
    }
    next();
  };
}
export function requireAuth(config: AuthConfig): RequestHandler {
  return async (req, res, next) => {
    const id = sessionSubject(req, config);
    if (!id) {
      clearSession(res, config);
      res.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "Please sign in." },
      });
      return;
    }
    const user = await User.findById(id).select(
      "name email createdAt updatedAt",
    );
    if (!user) {
      clearSession(res, config);
      res.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "Please sign in." },
      });
      return;
    }
    req.user = publicUser(user);
    next();
  };
}
