import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './lib/env.js';
import { authRouter } from './routes/auth.routes.js';
import { modelsRouter } from './routes/models.routes.js';
import { clientAccountsRouter } from './routes/clientAccounts.routes.js';
import { sharingRouter } from './routes/sharing.routes.js';
import { allocationListsRouter } from './routes/allocationLists.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Skipped entirely in the test environment so integration tests that hit
// these routes many times in quick succession (e.g. across the whole suite
// sharing one Postgres instance) never trip a limit meant for real traffic.
const skipInTest = () => env.NODE_ENV === 'test';

// A light ceiling on the API as a whole, plus a much stricter one on login
// specifically, since credential-stuffing/brute-force only really threatens
// that one route.
const globalLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
});

const loginLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: { error: 'TOO_MANY_REQUESTS', message: 'Too many login attempts. Try again in a minute.' },
});

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()) }));
  app.use(express.json());
  app.use(globalLimiter);
  if (env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth/login', loginLimiter);
  app.use('/api/auth', authRouter);
  app.use('/api/models', modelsRouter);
  app.use('/api/client-accounts', clientAccountsRouter);
  app.use('/api/models/:modelId/sharing', sharingRouter);
  app.use('/api/allocation-lists', allocationListsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
