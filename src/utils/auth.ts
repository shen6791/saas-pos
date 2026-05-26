import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import type { SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export const hashPassword = (password: string) => bcrypt.hash(password, 12);

export const verifyPassword = (password: string, hash: string) =>
  bcrypt.compare(password, hash);

export const signAccessToken = (input: {
  userId: string;
  tenantId: string;
  role: UserRole;
}) =>
  jwt.sign(
    {
      tenant_id: input.tenantId,
      tenantId: input.tenantId,
      role: input.role
    },
    env.JWT_SECRET,
    {
      subject: input.userId,
      expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"]
    }
  );
