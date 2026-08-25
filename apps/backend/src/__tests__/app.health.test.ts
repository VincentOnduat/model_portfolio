import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

describe('GET /health', () => {
  it('returns ok without requiring authentication', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('protected routes', () => {
  it('rejects requests with no Authorization header', async () => {
    const app = createApp();
    const res = await request(app).get('/api/models');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHENTICATED');
  });

  it('rejects requests with a malformed token', async () => {
    const app = createApp();
    const res = await request(app).get('/api/models').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('returns 404 with a structured body for unknown routes', async () => {
    const app = createApp();
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });
});
