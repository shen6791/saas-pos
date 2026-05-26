import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { env } from "../config/env";
import { HttpError } from "../utils/httpError";

type JwtPayload = {
  sub: string;
  tenantId?: string;
  tenant_id?: string;
  role: UserRole;
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    return next(new HttpError(401, "Missing bearer token"));
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const tenantId = payload.tenant_id ?? payload.tenantId;

    if (!payload.sub || !tenantId || !payload.role) {
      return next(new HttpError(401, "Invalid token payload"));
    }

    req.auth = {
      userId: payload.sub,
      tenantId,
      role: payload.role
    };
    return next();
  } catch {
    return next(new HttpError(401, "Invalid or expired token"));
  }
};

export const requireRole =
  (...roles: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) {
      return next(new HttpError(401, "Authentication required"));
    }

    if (!roles.includes(req.auth.role)) {
      return next(new HttpError(403, "Insufficient permissions"));
    }

    return next();
  };
