import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => {
  const query = vi.fn();
  const connection = {
    query: vi.fn(), beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(),
  };
  return { query, connection, getConnection: vi.fn(async () => connection) };
});

vi.mock('../config/db', () => ({ default: { query: mocks.query, getConnection: mocks.getConnection } }));
vi.mock('../middlewares/auth', () => ({
  requireCoreAuth: (req: any, _res: any, next: any) => { req.user = { id: 'user-1', full_name: 'Usuario de prueba' }; next(); },
}));
vi.mock('../integrations/coreClient', () => ({ getTicketContext: vi.fn(async () => null) }));
vi.mock('../services/ticketService', () => ({ createTicket: vi.fn() }));
vi.mock('../services/audit', () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock('../services/ticketAreaAccess', () => ({ validateTicketClassification: vi.fn() }));
vi.mock('../services/teamNotifications', () => ({ listTeamTicketNotifications: vi.fn() }));
vi.mock('../services/ticketCreationLimits', () => ({ withTicketCreationPermission: vi.fn(), sendTicketCreationLimitError: vi.fn() }));
vi.mock('../integrations/activosClient', () => ({ validateAssetUid: vi.fn() }));

import router from './ticketsSelf';

const app = express();
app.use(express.json());
app.use('/self', router);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.mockImplementation(async (sql: string) => {
    if (/SELECT id FROM tickets/.test(sql)) return [[{ id: 7 }]];
    if (/FROM ticket_comments/.test(sql) && /is_private = 0/.test(sql)) return [[{ id: 1, content: 'Visible', author_name: 'Soporte' }]];
    if (/SELECT id, author_id/.test(sql)) return [[{ id: 9, content: 'Respuesta', author_name: 'Usuario de prueba' }]];
    return [[]];
  });
  mocks.connection.query.mockImplementation(async (sql: string) => {
    if (/SELECT id FROM tickets/.test(sql)) return [[{ id: 7 }]];
    if (/INSERT INTO ticket_comments/.test(sql)) return [{ insertId: 9 }];
    return [{ affectedRows: 1 }];
  });
});

describe('conversación pública de autoservicio', () => {
  it('lista sólo comentarios no privados del ticket propio', async () => {
    const response = await request(app).get('/self/me/7/comments');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([{ id: 1, content: 'Visible', author_name: 'Soporte' }]);
    expect(mocks.query.mock.calls.some(([sql]) => /is_private = 0/.test(sql))).toBe(true);
  });

  it('crea siempre una respuesta pública y actualiza la actividad', async () => {
    const response = await request(app).post('/self/me/7/comments').send({ content: 'Respuesta' });
    expect(response.status).toBe(201);
    expect(mocks.connection.query.mock.calls.some(([sql]) => /is_private, content\) VALUES \(\?, \?, \?, 0, \?\)/.test(sql))).toBe(true);
    expect(mocks.connection.query.mock.calls.some(([sql]) => /UPDATE tickets SET updated_at/.test(sql))).toBe(true);
    expect(mocks.connection.commit).toHaveBeenCalledOnce();
  });

  it('rechaza mensajes vacíos antes de consultar datos', async () => {
    const response = await request(app).post('/self/me/7/comments').send({ content: '   ' });
    expect(response.status).toBe(400);
    expect(mocks.getConnection).not.toHaveBeenCalled();
  });
});
