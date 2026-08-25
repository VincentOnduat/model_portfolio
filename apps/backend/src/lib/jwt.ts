import jwt from 'jsonwebtoken';
import { Role } from '@model-portfolio/shared';
import { env } from './env.js';

export interface AuthTokenPayload {
  sub: string; // user id
  role: Role;
  firmId: string;
}

export function signAuthToken(payload: AuthTokenPayload): string {
  // env.JWT_EXPIRES_IN is a free-form config string (e.g. "12h"); jsonwebtoken's
  // types want its branded StringValue type, which can't be verified statically
  // from a plain string, hence the cast.
  const options: jwt.SignOptions = { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
}
