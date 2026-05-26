import { Router } from "express";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { hashPassword, signAccessToken, verifyPassword } from "../../utils/auth";
import { HttpError } from "../../utils/httpError";

export const authRouter = Router();

const registerSchema = z.object({
  tenantName: z.string().min(2),
  tenantSlug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only"),
  name: z.string().min(2),
  email: z.string().email().transform((email) => email.toLowerCase()),
  password: z.string().min(8)
});

authRouter.post("/register", async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const passwordHash = await hashPassword(input.password);

    const user = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: input.tenantName,
          slug: input.tenantSlug
        }
      });

      return tx.user.create({
        data: {
          tenantId: tenant.id,
          email: input.email,
          name: input.name,
          passwordHash,
          role: UserRole.OWNER
        },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      });
    });

    const token = signAccessToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role
    });

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        tenantId: user.tenantId,
        tenant: user.tenant,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    return next(error);
  }
});

const loginSchema = z.object({
  tenantSlug: z.string().min(2),
  email: z.string().email().transform((email) => email.toLowerCase()),
  password: z.string().min(1)
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const tenant = await prisma.tenant.findUnique({
      where: { slug: input.tenantSlug },
      select: { id: true, name: true, slug: true }
    });

    if (!tenant) {
      throw new HttpError(401, "Invalid credentials");
    }

    const user = await prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: input.email
        }
      }
    });

    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new HttpError(401, "Invalid credentials");
    }

    const token = signAccessToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role
    });

    return res.json({
      token,
      user: {
        id: user.id,
        tenantId: user.tenantId,
        tenant,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    return next(error);
  }
});
