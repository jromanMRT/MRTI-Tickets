import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
vi.mock('axios', () => ({ default: { get: vi.fn() } }));
import { requireAuth, requireCoreAuth } from './auth';
import { introspectToken } from '../integrations/coreClient';

vi.mock('../integrations/coreClient', () => ({ introspectToken: vi.fn() }));

function response() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('autorización de autoservicio Tickets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('permite sesión Core sin módulo en rutas de autoservicio', async () => {
    vi.mocked(introspectToken).mockResolvedValue({ active: true, user: { id: 'user-1', role: 'viewer', allowed_modules: [] } });
    const req: any = { headers: { authorization: 'Bearer token' } };
    const res = response();
    const next = vi.fn();
    await requireCoreAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user.id).toBe('user-1');
  });

  it('mantiene bloqueado el módulo operativo sin permiso Tickets', async () => {
    vi.mocked(introspectToken).mockResolvedValue({ active: true, user: { id: 'user-1', role: 'viewer', allowed_modules: [] } });
    const req: any = { headers: { authorization: 'Bearer token' } };
    const res = response();
    const next = vi.fn();
    await requireAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('permisos granulares de Tickets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('MRTI_CORE_URL', 'http://core.test');
    vi.mocked(introspectToken).mockResolvedValue({ active: true, user: { id: 'user-1', role: 'viewer', allowed_modules: ['tickets'] } });
  });
  it.each([204,401,403,500])('respeta la autoridad: %s', async (status) => {
    if (status === 204) vi.mocked(axios.get).mockResolvedValue({ status });
    else vi.mocked(axios.get).mockRejectedValue({ response: { status } });
    const req: any = { headers: { authorization: 'Bearer token' }, method: 'POST', originalUrl: '/api/tickets?query=private' };
    const res = response(); const next = vi.fn();
    await requireAuth(req, res, next);
    expect(axios.get).toHaveBeenCalledWith('http://core.test/api/auth/module-access/tickets', expect.objectContaining({ params: { method: 'POST', path: '/api/tickets' }, timeout: 5000 }));
    if (status === 204) expect(next).toHaveBeenCalledOnce();
    else { expect(next).not.toHaveBeenCalled(); expect(res.status).toHaveBeenCalledWith(status === 500 ? 503 : status); }
  });
});
