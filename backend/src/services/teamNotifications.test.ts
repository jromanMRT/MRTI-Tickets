import { beforeEach, describe, expect, it, vi } from 'vitest';
import pool from '../config/db';
import { listTeamTicketNotifications } from './teamNotifications';

vi.mock('../config/db', () => ({ default: { query: vi.fn() } }));

describe('notificaciones de equipos de Tickets', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('consulta sólo tickets abiertos, sin responsable y de las áreas del usuario', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce([[{ id: 7, folio: 'MRTI-2026-000007' }], []] as any);
    await expect(listTeamTicketNotifications('user-1')).resolves.toEqual([{ id: 7, folio: 'MRTI-2026-000007' }]);
    const [sql, params] = vi.mocked(pool.query).mock.calls[0];
    expect(sql).toContain('business_area_members');
    expect(sql).toContain('t.assigned_to IS NULL');
    expect(sql).toContain("'RESOLVED', 'CLOSED', 'CANCELLED'");
    expect(params).toEqual(['user-1', 10]);
  });
});
