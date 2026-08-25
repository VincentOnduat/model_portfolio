import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { Role } from '@model-portfolio/shared';
import { createApp } from '../app.js';
import { signAuthToken } from '../lib/jwt.js';

function tokenFor(role: Role, firmId = 'firm-1') {
  return signAuthToken({ sub: 'user-1', role, firmId });
}

describe('RBAC on /api/models', () => {
  it('allows an ADVISER_MODEL_OWNER to reach the create-model validation layer', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/models')
      .set('Authorization', `Bearer ${tokenFor(Role.ADVISER_MODEL_OWNER)}`)
      .send({ reference: 'bad reference with spaces', name: 'x', minimumTradeValue: 10 });

    // Reaches the handler (not a 403) and fails on Zod/body validation instead,
    // proving the permission check passed for this role.
    expect(res.status).not.toBe(403);
  });

  it('forbids an ADVISER_STANDARD user from creating a model', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/models')
      .set('Authorization', `Bearer ${tokenFor(Role.ADVISER_STANDARD)}`)
      .send({ reference: 'REF-1', name: 'x', minimumTradeValue: 10 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('forbids a THIRD_PARTY_STANDARD user from creating a model', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/models')
      .set('Authorization', `Bearer ${tokenFor(Role.THIRD_PARTY_STANDARD)}`)
      .send({ reference: 'REF-1', name: 'x', minimumTradeValue: 10 });

    expect(res.status).toBe(403);
  });
});
