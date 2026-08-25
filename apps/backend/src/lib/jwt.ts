import jwt from 'jsonwebtoken';
import { Role } from '@model-portfolio/shared';
import { env } from './env.js';

export interface AuthTokenPayload {
  sub: string; // user id
  role: Role;
  firmId: string;
}

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
}
