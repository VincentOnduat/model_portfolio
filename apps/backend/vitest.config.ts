import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    env: {
      // Matches docker-compose.yml/CI's Postgres service credentials - was
      // previously a placeholder "test:test@.../test" that pointed at a
      // database/user that never existed anywhere, unnoticed because no
      // backend test touched the DB until allocationLists.service.test.ts.
      DATABASE_URL: 'postgresql://model_portfolio:model_portfolio@localhost:5432/model_portfolio?schema=public',
      JWT_SECRET: 'test-secret-value',
      NODE_ENV: 'test',
      CORS_ORIGIN: 'http://localhost:5173',
    },
  },
});
