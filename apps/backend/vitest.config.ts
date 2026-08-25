import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test?schema=public',
      JWT_SECRET: 'test-secret-value',
      NODE_ENV: 'test',
      CORS_ORIGIN: 'http://localhost:5173',
    },
  },
});
