import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './lib/env.js';
import { authRouter } from './routes/auth.routes.js';
import { modelsRouter } from './routes/models.routes.js';
import { clientAccountsRouter } from './routes/clientAccounts.routes.js';
import { sharingRouter } from './routes/sharing.routes.js';
import { allocationListsRouter } from './routes/allocationLists.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()) }));
  app.use(express.json());
  if (env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth', authRouter);
  app.use('/api/models', modelsRouter);
  app.use('/api/client-accounts', clientAccountsRouter);
  app.use('/api/models/:modelId/sharing', sharingRouter);
  app.use('/api/allocation-lists', allocationListsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
