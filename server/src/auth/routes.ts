import { Router } from "express";
import bcrypt from "bcrypt";
import { rateLimit } from "express-rate-limit";
import type { AuthConfig } from "../config/auth.js";
import { User } from "../models/user.js";
import { csrfProtection, requireAuth } from "./middleware.js";
import { clearSession, establishSession, publicUser } from "./session.js";
import { loginSchema, registrationSchema } from "./validation.js";

// Non-account comparison hash, deliberately public. Equal bcrypt cost for missing users.
const DUMMY_HASH =
  "$2b$12$RrxeKt0rbWoVBwmNEPiaT.GIUOxvm4iUe71CiY8AXjlSIC22QTawK";
export function authRouter(config: AuthConfig) {
  const router = Router();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(csrfProtection(config));
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // Untrusted forwarded headers are intentionally ignored while trust proxy is false.
    validate: { xForwardedForHeader: false },
    message: {
      error: {
        code: "RATE_LIMITED",
        message: "Too many authentication attempts. Try again later.",
      },
    },
  });
  router.post("/register", limiter, async (req, res) => {
    const result = registrationSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Check the supplied fields.",
          fields: result.error.flatten().fieldErrors,
        },
      });
      return;
    }
    const { name, email, password } = result.data;
    const passwordHash = await bcrypt.hash(password, 12);
    let user;
    try {
      user = await User.create({ name, email, passwordHash });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        res.status(409).json({
          error: {
            code: "EMAIL_IN_USE",
            message: "An account with that email already exists.",
          },
        });
        return;
      }
      throw error;
    }
    establishSession(res, user._id.toString(), config);
    res.status(201).json({ data: { user: publicUser(user) } });
  });
  router.post("/login", limiter, async (req, res) => {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Check the supplied fields.",
          fields: result.error.flatten().fieldErrors,
        },
      });
      return;
    }
    const { email, password } = result.data;
    const user = await User.findOne({ email }).select("+passwordHash");
    const matches = await bcrypt.compare(
      password,
      user?.passwordHash ?? DUMMY_HASH,
    );
    if (!user || !matches) {
      res.status(401).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Email or password is incorrect.",
        },
      });
      return;
    }
    establishSession(res, user._id.toString(), config);
    res.status(200).json({ data: { user: publicUser(user) } });
  });
  router.get("/me", requireAuth(config), (req, res) => {
    res.status(200).json({ data: { user: req.user } });
  });
  router.post("/logout", (_req, res) => {
    clearSession(res, config);
    res.status(204).end();
  });
  return router;
}
