import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('axios', () => ({ default: { get: vi.fn(async () => ({ status: 204 })) } }));
vi.stubEnv('MRTI_CORE_URL', 'http://core.test');

vi.mock('../config/db', () => ({ default: { query: vi.fn(async () => [[{ code: 'P3' }]]) } }));
vi.mock('../integrations/coreClient', () => ({
  introspectToken: vi.fn(async (token: string) => ({ active: true, user: { id: 'requester', role: token, full_name: 'Solicitante', allowed_modules: ['tickets'] } })),
  getTicketContext: vi.fn(async () => ({
    primary_device: { id: 'my-device', internal_id: 'OWN-1', name: 'Mi equipo' },
    location: { area_id: 'my-area', area_name: 'Mi área' },
    area_devices: [{ id: 'my-device', internal_id: 'OWN-1', name: 'Mi equipo' }],
    can_select_any_equipment: true,
    equipment_options: [{ key: 'asset:other', asset_uid: 'other', device_id: null, internal_id: 'TI-002', name: 'Laptop ajena' }],
  })),
}));
vi.mock('../services/ticketService', () => ({ createTicket: vi.fn(async (data) => ({ id: 1, folio: 'TEST-1', ...data })) }));
vi.mock('../services/audit', () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock('../services/ticketAreaAccess', () => ({ validateTicketClassification: vi.fn(async () => ({ valid: true })), getTicketAreaScope: vi.fn(), requireTicketAreaAccess: vi.fn() }));
vi.mock('../services/ticketCreationLimits', () => ({ withTicketCreationPermission: vi.fn(async (_id, fn) => fn()), sendTicketCreationLimitError: vi.fn(() => false) }));
vi.mock('../integrations/activosClient', () => ({ validateAssetUid: vi.fn(async () => ({ status: 'valid' })) }));
import tickets from './tickets';
import ticketsSelf from './ticketsSelf';
import { createTicket } from '../services/ticketService';

const app = express();
app.use(express.json());
app.use('/tickets', tickets);
app.use('/self', ticketsSelf);
const payload = { title: 'Revisar otro equipo', business_area_id: 1, category_id: 1, affected_equipment: 'asset:other' };
beforeEach(() => { vi.clearAllMocks(); });

describe.each(['/tickets', '/self'])('contrato HTTP %s', (route) => {
  it('admin crea para otro activo conservando solicitante y equipo habitual', async () => {
    const res = await request(app).post(route).set('Authorization', 'Bearer administrator').send({ ...payload, requester_id: 'forged', affected_device_name: 'forged' });
    expect(res.status).toBe(201);
    expect(createTicket).toHaveBeenCalledWith(expect.objectContaining({ asset_uid: 'other', related_device_id: null, affected_device_name: 'Laptop ajena', requester_id: 'requester', requester_device_id: 'my-device', origin_area_id: 'my-area' }));
  });
  it('no admin no puede ampliar su alcance', async () => {
    const res = await request(app).post(route).set('Authorization', 'Bearer viewer').send(payload);
    expect(res.status).toBe(403);
    expect(createTicket).not.toHaveBeenCalled();
  });
  it('equipo inexistente no genera ticket', async () => {
    const res = await request(app).post(route).set('Authorization', 'Bearer administrator').send({ ...payload, affected_equipment: 'asset:missing' });
    expect(res.status).toBe(400);
    expect(createTicket).not.toHaveBeenCalled();
  });
  it('sin equipo no guarda el habitual como afectado', async () => {
    const res = await request(app).post(route).set('Authorization', 'Bearer administrator').send({ ...payload, affected_equipment: '' });
    expect(res.status).toBe(201);
    expect(createTicket).toHaveBeenCalledWith(expect.objectContaining({ asset_uid: null, related_device_id: null, affected_device_name: null, requester_device_id: 'my-device' }));
  });
  it('sin sesión devuelve 401', async () => {
    expect((await request(app).post(route).send(payload)).status).toBe(401);
    expect(createTicket).not.toHaveBeenCalled();
  });
  it('el cliente anterior sigue creando tickets', async () => {
    const legacy = Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'affected_equipment'));
    expect((await request(app).post(route).set('Authorization', 'Bearer viewer').send(legacy)).status).toBe(201);
  });
});
