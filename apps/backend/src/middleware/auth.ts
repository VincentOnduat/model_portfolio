import type { NextFunction, Request, Response } from 'express';
import { Permission, roleHasPermission } from '@model-portfolio/shared';
import { verifyAuthToken } from '../lib/jwt.js';
import { ApiException } from './errorHandler.js';

/** Verifies the `Authorization: Bearer <token>` header and attaches req.user. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new ApiException(401, 'UNAUTHENTICATED', 'Missing or malformed Authorization header.');
  }

  const token = header.slice('Bearer '.length);
  try {
    req.user = verifyAuthToken(token);
  } catch {
    throw new ApiException(401, 'UNAUTHENTICATED', 'Invalid or expired token.');
  }
  next();
}

/**
 * Coarse-grained RBAC gate, checked against the static role -> permission
 * matrix in packages/shared/src/permissions.ts. Route handlers that also
 * need per-model sharing-grant checks (e.g. "can this ADVISER_STANDARD user
 * edit *this* model") perform that finer-grained check themselves after this
 * middleware has confirmed the role is allowed to use the feature at all.
 */
export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new ApiException(401, 'UNAUTHENTICATED', 'Missing or malformed Authorization header.');
    }
    if (!roleHasPermission(req.user.role, permission)) {
      throw new ApiException(
        403,
        'FORBIDDEN',
        `Role ${req.user.role} does not have permission ${permission}.`,
      );
    }
    next();
  };
}
