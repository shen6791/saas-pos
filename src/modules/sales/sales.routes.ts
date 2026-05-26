import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middleware/auth";
import { requireTenant } from "../../middleware/tenant";
import { HttpError } from "../../utils/httpError";

export const salesRouter = Router();

salesRouter.use(requireAuth, requireTenant);

salesRouter.get("/", async (req, res, next) => {
  try {
    const { tenant_id } = req.context!;
    const sales = await prisma.sale.findMany({
      where: { tenantId: tenant_id },
      include: {
        cashier: { select: { id: true, name: true, email: true } },
        items: { include: { product: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    return res.json({ sales });
  } catch (error) {
    return next(error);
  }
});

const saleSchema = z.object({
  taxCents: z.number().int().nonnegative().default(0),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive()
      })
    )
    .min(1)
});

salesRouter.post("/", async (req, res, next) => {
  try {
    const { tenant_id, user_id } = req.context!;
    const input = saleSchema.parse(req.body);
    const sale = await prisma.$transaction(async (tx) => {
      const requestedItems = Array.from(
        input.items
          .reduce((itemsByProduct, item) => {
            const currentQuantity = itemsByProduct.get(item.productId) ?? 0;
            itemsByProduct.set(item.productId, currentQuantity + item.quantity);
            return itemsByProduct;
          }, new Map<string, number>())
          .entries()
      ).map(([productId, quantity]) => ({ productId, quantity }));

      const products = await tx.product.findMany({
        where: {
          tenantId: tenant_id,
          id: { in: requestedItems.map((item) => item.productId) },
          active: true
        }
      });

      const productMap = new Map(products.map((product) => [product.id, product]));
      const saleItems = requestedItems.map((item) => {
        const product = productMap.get(item.productId);

        if (!product) {
          throw new HttpError(400, `Product ${item.productId} is not available`);
        }

        if (product.stock < item.quantity) {
          throw new HttpError(409, `Insufficient stock for ${product.name}`);
        }

        const lineTotalCents = product.priceCents * item.quantity;

        return {
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          unitPriceCents: product.priceCents,
          lineTotalCents
        };
      });

      const subtotalCents = saleItems.reduce(
        (sum, item) => sum + item.lineTotalCents,
        0
      );
      const totalCents = subtotalCents + input.taxCents;

      for (const item of saleItems) {
        const update = await tx.product.updateMany({
          where: {
            id: item.productId,
            tenantId: tenant_id,
            active: true,
            stock: { gte: item.quantity }
          },
          data: { stock: { decrement: item.quantity } }
        });

        if (update.count !== 1) {
          throw new HttpError(409, `Insufficient stock for ${item.productName}`);
        }
      }

      const createdSale = await tx.sale.create({
        data: {
          tenantId: tenant_id,
          cashierId: user_id,
          subtotalCents,
          taxCents: input.taxCents,
          totalCents,
          items: {
            create: saleItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCents,
              lineTotalCents: item.lineTotalCents
            }))
          }
        },
        include: {
          items: { include: { product: true } },
          cashier: { select: { id: true, name: true, email: true } }
        }
      });

      return createdSale;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });

    return res.status(201).json({ sale });
  } catch (error) {
    return next(error);
  }
});
