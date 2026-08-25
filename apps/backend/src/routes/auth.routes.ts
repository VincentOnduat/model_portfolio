import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { signAuthToken } from '../lib/jwt.js';
import { asyncHandler, ApiException } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new ApiException(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new ApiException(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }

    const token = signAuthToken({ sub: user.id, role: user.role, firmId: user.firmId });
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        firmId: user.firmId,
      },
    });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.sub } });
    res.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      firmId: user.firmId,
    });
  }),
);
