import { beforeEach, describe, expect, it, vi } from 'vitest';
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
