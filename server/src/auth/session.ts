import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { parse } from "cookie";
import type { Request, Response, CookieOptions } from "express";
import type { AuthConfig } from "../config/auth.js";
import type { Types } from "mongoose";

export const SESSION_SECONDS = 1800;
export type PublicUser = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
};
export function publicUser(user: {
  _id: Types.ObjectId;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}): PublicUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
function cookieName(config: AuthConfig) {
  return config.NODE_ENV === "production"
    ? "__Host-taskflow"
    : "taskflow_session";
}
function options(config: AuthConfig): CookieOptions {
  return {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}
export function establishSession(
  res: Response,
  id: string,
  config: AuthConfig,
) {
  const token = jwt.sign({}, config.JWT_SECRET, {
    algorithm: "HS256",
    subject: id,
    issuer: "taskflow-api",
    audience: "taskflow-web",
    expiresIn: SESSION_SECONDS,
    jwtid: randomUUID(),
  });
  res.cookie(cookieName(config), token, {
    ...options(config),
    maxAge: SESSION_SECONDS * 1000,
  });
}
export function clearSession(res: Response, config: AuthConfig) {
  res.clearCookie(cookieName(config), options(config));
}
export function sessionSubject(
  req: Request,
  config: AuthConfig,
): string | undefined {
  try {
    const token = parse(req.headers.cookie ?? "")[cookieName(config)];
    if (!token) return;
    const payload = jwt.verify(token, config.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "taskflow-api",
      audience: "taskflow-web",
      maxAge: SESSION_SECONDS,
    });
    if (
      typeof payload === "string" ||
      typeof payload.sub !== "string" ||
      !/^[a-f\d]{24}$/i.test(payload.sub) ||
      typeof payload.exp !== "number" ||
      typeof payload.iat !== "number" ||
      payload.iat > Math.floor(Date.now() / 1000) ||
      payload.exp > payload.iat + SESSION_SECONDS
    )
      return;
    return payload.sub;
  } catch {
    return;
  }
}
