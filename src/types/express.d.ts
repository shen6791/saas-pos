import type { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        tenantId: string;
        role: UserRole;
      };
      context?: {
        tenant_id: string;
        user_id: string;
        role: UserRole;
      };
    }
  }
}

export {};
