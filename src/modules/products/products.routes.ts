import { Router } from "express";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole } from "../../middleware/auth";
import { requireTenant } from "../../middleware/tenant";
import { HttpError } from "../../utils/httpError";

export const productsRouter = Router();

productsRouter.use(requireAuth, requireTenant);

productsRouter.get("/", async (req, res, next) => {
  try {
    const { tenant_id } = req.context!;
    const products = await prisma.product.findMany({
      where: { tenantId: tenant_id },
      orderBy: { createdAt: "desc" }
    });

    return res.json({ products });
  } catch (error) {
    return next(error);
  }
});

const productSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(2),
  description: z.string().optional(),
  priceCents: z.number().int().nonnegative(),
  stock: z.number().int().default(0),
  active: z.boolean().default(true)
});

productsRouter.post(
  "/",
  requireRole(UserRole.OWNER, UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const { tenant_id } = req.context!;
      const input = productSchema.parse(req.body);
      const product = await prisma.product.create({
        data: {
          ...input,
          tenantId: tenant_id
        }
      });

      return res.status(201).json({ product });
    } catch (error) {
      return next(error);
    }
  }
);

productsRouter.patch(
  "/:id",
  requireRole(UserRole.OWNER, UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const { tenant_id } = req.context!;
      const input = productSchema.partial().parse(req.body);
      const result = await prisma.product.updateMany({
        where: {
          id: req.params.id,
          tenantId: tenant_id
        },
        data: input
      });

      if (result.count === 0) {
        throw new HttpError(404, "Product not found");
      }

      const product = await prisma.product.findFirstOrThrow({
        where: {
          id: req.params.id,
          tenantId: tenant_id
        }
      });

      return res.json({ product });
    } catch (error) {
      return next(error);
    }
  }
);
