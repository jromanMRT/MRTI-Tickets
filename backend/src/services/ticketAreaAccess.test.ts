import { beforeEach, describe, expect, it, vi } from 'vitest';
import pool from '../config/db';
import { canAccessTicket, getTicketAreaScope, isGlobalTicketAdministrator } from './ticketAreaAccess';

vi.mock('../config/db', () => ({ default: { query: vi.fn() } }));

describe('seguridad de tickets por área', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('reconoce al administrador global y no limita su consulta', async () => {
    expect(isGlobalTicketAdministrator({ role: 'administrator' })).toBe(true);
    await expect(getTicketAreaScope({ role: 'administrator' })).resolves.toEqual({ sql: '1 = 1', params: [] });
  });

  it('limita la bandeja del operador a sus membresías', async () => {
    const scope = await getTicketAreaScope({ id: 'rh-user', role: 'technician' });
    expect(scope.sql).toContain('business_area_members');
    expect(scope.params).toEqual(['rh-user']);
  });

  it('permite el detalle sólo cuando la persona pertenece al área', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce([[{ business_area_id: 4 }], []] as any)
      .mockResolvedValueOnce([[{ allowed: 1 }], []] as any);
    await expect(canAccessTicket({ id: 'rh-user', role: 'technician' }, 25)).resolves.toBe('allowed');
  });

  it('rechaza el detalle de otra área', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce([[{ business_area_id: 4 }], []] as any)
      .mockResolvedValueOnce([[], []] as any);
    await expect(canAccessTicket({ id: 'ti-user', role: 'technician' }, 25)).resolves.toBe('forbidden');
  });
});
