import type { NextFunction, Request, Response } from 'express';
import type { ApiError } from '@model-portfolio/shared';

export class ApiException extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiException';
  }
}

/** Wraps an async route handler so rejected promises reach the error middleware. */
export function asyncHandler<T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: T, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiException) {
    const body: ApiError = { error: err.code, message: err.message, details: err.details };
    res.status(err.status).json(body);
    return;
  }

  console.error('Unhandled error:', err);
  const body: ApiError = { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' };
  res.status(500).json(body);
}

export function notFoundHandler(req: Request, res: Response): void {
  const body: ApiError = { error: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` };
  res.status(404).json(body);
}
