import { Router } from "express";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole } from "../../middleware/auth";
import { requireTenant } from "../../middleware/tenant";
import { hashPassword } from "../../utils/auth";

export const usersRouter = Router();

usersRouter.use(requireAuth, requireTenant);

usersRouter.get("/me", async (req, res, next) => {
  try {
    const { tenant_id, user_id } = req.context!;
    const user = await prisma.user.findFirstOrThrow({
      where: {
        id: user_id,
        tenantId: tenant_id
      },
      select: {
        id: true,
        tenantId: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return res.json({ user });
  } catch (error) {
    return next(error);
  }
});

usersRouter.get(
  "/",
  requireRole(UserRole.OWNER, UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const { tenant_id } = req.context!;
      const users = await prisma.user.findMany({
        where: { tenantId: tenant_id },
        select: {
          id: true,
          tenantId: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { createdAt: "desc" }
      });

      return res.json({ users });
    } catch (error) {
      return next(error);
    }
  }
);

const createUserSchema = z.object({
  email: z.string().email().transform((email) => email.toLowerCase()),
  name: z.string().min(2),
  password: z.string().min(8),
  role: z.nativeEnum(UserRole).default(UserRole.CASHIER)
});

usersRouter.post(
  "/",
  requireRole(UserRole.OWNER, UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const { tenant_id } = req.context!;
      const input = createUserSchema.parse(req.body);
      const user = await prisma.user.create({
        data: {
          tenantId: tenant_id,
          email: input.email,
          name: input.name,
          passwordHash: await hashPassword(input.password),
          role: input.role
        },
        select: {
          id: true,
          tenantId: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return res.status(201).json({ user });
    } catch (error) {
      return next(error);
    }
  }
);
