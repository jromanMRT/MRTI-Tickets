import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../src/app';

let app: any;

beforeAll(() => {
  app = createApp();
});

describe('API sanity', () => {
  it('responds to health check', async () => {
    const response = await request(app).get('/api/health').set('X-Request-Id', 'tickets-test-20261014');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.headers['x-request-id']).toBe('tickets-test-20261014');
  });

  it('reemplaza request IDs inválidos sin reflejarlos', async () => {
    const response = await request(app).get('/api/health').set('X-Request-Id', 'inválido con espacios');
    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toMatch(/^[A-Za-z0-9._-]{8,64}$/);
    expect(response.headers['x-request-id']).not.toBe('inválido con espacios');
  });
});
