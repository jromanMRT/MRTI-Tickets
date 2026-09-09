import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildFolio } from './folio';
import pool from '../config/db';
import { createTicket } from './ticketService';

describe('folio service', () => {
  it('builds formatted folio strings', () => {
    expect(buildFolio(2026, 1)).toBe('MRTI-2026-000001');
    expect(buildFolio(2026, 123)).toBe('MRTI-2026-000123');
  });
});

vi.mock('../config/db', () => ({ default: { getConnection: vi.fn() } }));

function mockConnection(policyRows: any[]) {
  const calls: Array<{ sql: string; params?: any[] }> = [];
  return {
    calls,
    connection: {
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
      release() {},
      async query(sql: string, params?: any[]) {
        calls.push({ sql, params });
        if (/SELECT id FROM ticket_statuses/.test(sql)) return [[{ id: 1 }]];
        if (/SELECT id FROM sla_policies/.test(sql)) return [policyRows];
        if (/INSERT INTO tickets/.test(sql)) return [{ insertId: 42 }];
        if (/UPDATE tickets SET folio/.test(sql)) return [{ affectedRows: 1 }];
        if (/INSERT INTO ticket_status_history/.test(sql)) return [{ affectedRows: 1 }];
        if (/SELECT id, folio, title, status_id, created_at FROM tickets/.test(sql)) return [[{ id: 42, folio: 'MRTI-2026-000042' }]];
        return [[]];
      },
    },
  };
}

describe('createTicket: resolución de política de SLA', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('busca la política pasando prioridad, categoría y área -- la más específica gana en SQL, no aquí', async () => {
    const { connection, calls } = mockConnection([{ id: 7 }]);
    vi.mocked(pool.getConnection).mockResolvedValue(connection as any);

    await createTicket({
      title: 'Prueba', business_area_id: 3, category_id: 9, priority_code: 'P2',
    });

    const policyCall = calls.find((c) => /SELECT id FROM sla_policies/.test(c.sql));
    expect(policyCall?.params).toEqual(['P2', 9, 3]);
  });

  it('no consulta sla_policies si ya viene un sla_policy_id explícito', async () => {
    const { connection, calls } = mockConnection([]);
    vi.mocked(pool.getConnection).mockResolvedValue(connection as any);

    await createTicket({
      title: 'Prueba', business_area_id: 3, category_id: 9, priority_code: 'P2', sla_policy_id: 99,
    });

    expect(calls.some((c) => /SELECT id FROM sla_policies/.test(c.sql))).toBe(false);
  });

  it('sin política que coincida, el ticket se crea sin SLA (sla_policy_id null)', async () => {
    const { connection, calls } = mockConnection([]);
    vi.mocked(pool.getConnection).mockResolvedValue(connection as any);

    await createTicket({ title: 'Prueba', business_area_id: 3, category_id: null, priority_code: 'P4' });

    const insertCall = calls.find((c) => /INSERT INTO tickets/.test(c.sql));
    expect(insertCall?.params?.[insertCall.params.length - 1]).toBe(null);
  });
});
