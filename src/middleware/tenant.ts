import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma";
import { HttpError } from "../utils/httpError";

export const requireTenant: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.auth?.tenantId) {
      throw new HttpError(401, "Tenant context missing");
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.auth.tenantId },
      select: { id: true }
    });

    if (!tenant) {
      throw new HttpError(403, "Tenant is not available");
    }

    req.context = {
      tenant_id: req.auth.tenantId,
      user_id: req.auth.userId,
      role: req.auth.role
    };

    return next();
  } catch (error) {
    return next(error);
  }
};
