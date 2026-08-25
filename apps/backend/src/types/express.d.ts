import type { AuthTokenPayload } from '../lib/jwt.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

export {};
