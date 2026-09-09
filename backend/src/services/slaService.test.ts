import { beforeEach, describe, expect, it, vi } from 'vitest';
import pool from '../config/db';
import { applySlaPauseTransition, getSlaStatusForTicket, ON_HOLD_STATUS_CODES } from './slaService';

vi.mock('../config/db', () => ({ default: { query: vi.fn() } }));

function mockConnection(rows: Record<string, any>) {
  const calls: Array<{ sql: string; params?: any[] }> = [];
  return {
    calls,
    query: vi.fn(async (sql: string, params?: any[]) => {
      calls.push({ sql, params });
      if (/SELECT sla_policy_id, sla_paused_since FROM tickets/.test(sql)) return [[rows.ticket]];
      return [{ affectedRows: 1 }];
    }),
  };
}

describe('getSlaStatusForTicket', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('descuenta del tiempo consumido una pausa ya terminada (sla_paused_minutes)', async () => {
    const createdAt = new Date(Date.now() - 200 * 60000); // hace 200 min
    vi.mocked(pool.query)
      .mockResolvedValueOnce([[{ created_at: createdAt, sla_policy_id: 1, status_id: 5, sla_paused_minutes: 100, sla_paused_since: null }]] as any)
      .mockResolvedValueOnce([[{ id: 1, name: 'SLA alto', priority_code: 'P2', first_response_minutes: 30, resolution_minutes: 480 }]] as any)
      .mockResolvedValueOnce([[{ code: 'IN_PROGRESS' }]] as any);
    const status = await getSlaStatusForTicket(42);
    // 200 min transcurridos - 100 pausados = 100 min efectivos de 480 -> ~21%
    expect(status.elapsedMinutes).toBe(100);
    expect(status.pausedMinutes).toBe(100);
    expect(status.percentConsumed).toBe(21);
    expect(status.state).toBe('En tiempo');
  });

  it('congela el consumo mientras la pausa sigue activa (sla_paused_since)', async () => {
    const createdAt = new Date(Date.now() - 500 * 60000);
    const pausedSince = new Date(Date.now() - 300 * 60000); // lleva 300 min pausado
    vi.mocked(pool.query)
      .mockResolvedValueOnce([[{ created_at: createdAt, sla_policy_id: 1, status_id: 6, sla_paused_minutes: 0, sla_paused_since: pausedSince }]] as any)
      .mockResolvedValueOnce([[{ id: 1, name: 'SLA alto', priority_code: 'P2', first_response_minutes: 30, resolution_minutes: 480 }]] as any)
      .mockResolvedValueOnce([[{ code: 'ON_HOLD_USER' }]] as any);
    const status = await getSlaStatusForTicket(42);
    // 500 - 300 pausados en vivo = 200 min efectivos, muy por debajo de vencer
    expect(status.elapsedMinutes).toBe(200);
    expect(status.state).toBe('Pausado');
    expect(status.remainingMinutes).toBe(280);
  });

  it('marca vencido sólo cuando el tiempo efectivo (no pausado) supera la resolución', async () => {
    const createdAt = new Date(Date.now() - 1000 * 60000);
    vi.mocked(pool.query)
      .mockResolvedValueOnce([[{ created_at: createdAt, sla_policy_id: 1, status_id: 5, sla_paused_minutes: 0, sla_paused_since: null }]] as any)
      .mockResolvedValueOnce([[{ id: 1, name: 'SLA alto', priority_code: 'P2', first_response_minutes: 30, resolution_minutes: 480 }]] as any)
      .mockResolvedValueOnce([[{ code: 'IN_PROGRESS' }]] as any);
    const status = await getSlaStatusForTicket(42);
    expect(status.state).toBe('Vencido');
    expect(status.remainingMinutes).toBeLessThan(0);
  });

  it('un ticket resuelto se marca cumplido aunque haya superado el tiempo', async () => {
    const createdAt = new Date(Date.now() - 1000 * 60000);
    vi.mocked(pool.query)
      .mockResolvedValueOnce([[{ created_at: createdAt, sla_policy_id: 1, status_id: 9, sla_paused_minutes: 0, sla_paused_since: null }]] as any)
      .mockResolvedValueOnce([[{ id: 1, name: 'SLA alto', priority_code: 'P2', first_response_minutes: 30, resolution_minutes: 480 }]] as any)
      .mockResolvedValueOnce([[{ code: 'RESOLVED' }]] as any);
    const status = await getSlaStatusForTicket(42);
    expect(status.state).toBe('Cumplido');
  });

  it('un ticket cancelado se marca cumplido, no pausado ni vencido (antes sólo miraba RESOLVED/CLOSED)', async () => {
    const createdAt = new Date(Date.now() - 1000 * 60000);
    vi.mocked(pool.query)
      .mockResolvedValueOnce([[{ created_at: createdAt, sla_policy_id: 1, status_id: 10, sla_paused_minutes: 0, sla_paused_since: new Date() }]] as any)
      .mockResolvedValueOnce([[{ id: 1, name: 'SLA alto', priority_code: 'P2', first_response_minutes: 30, resolution_minutes: 480 }]] as any)
      .mockResolvedValueOnce([[{ code: 'CANCELLED' }]] as any);
    const status = await getSlaStatusForTicket(42);
    expect(status.state).toBe('Cumplido');
  });

  it('sin política de SLA responde "Sin SLA" sin consultar más tablas', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce([[{ created_at: new Date(), sla_policy_id: null, status_id: 1 }]] as any);
    const status = await getSlaStatusForTicket(42);
    expect(status).toEqual({ elapsedMinutes: 0, pausedMinutes: 0, remainingMinutes: null, percentConsumed: null, state: 'Sin SLA', deadline: null });
    expect(vi.mocked(pool.query)).toHaveBeenCalledTimes(1);
  });
});

describe('applySlaPauseTransition', () => {
  it('registra una pausa al entrar a un estado de espera', async () => {
    const connection = mockConnection({ ticket: { sla_policy_id: 2, sla_paused_since: null } });
    await applySlaPauseTransition(connection, 10, 'IN_PROGRESS', 'ON_HOLD_USER');
    expect(connection.calls.some((c) => /UPDATE tickets SET sla_paused_since = NOW\(\)/.test(c.sql))).toBe(true);
    const insert = connection.calls.find((c) => /INSERT INTO ticket_sla_events/.test(c.sql));
    expect(insert?.params).toEqual([10, 2, 'sla_paused', JSON.stringify({ from_status_code: 'IN_PROGRESS', to_status_code: 'ON_HOLD_USER' })]);
  });

  it('acredita la pausa y limpia la marca al salir de un estado de espera', async () => {
    const connection = mockConnection({ ticket: { sla_policy_id: 2, sla_paused_since: new Date() } });
    await applySlaPauseTransition(connection, 10, 'ON_HOLD_VENDOR', 'IN_PROGRESS');
    expect(connection.calls.some((c) => /sla_paused_minutes = sla_paused_minutes \+/.test(c.sql) && /sla_paused_since = NULL/.test(c.sql))).toBe(true);
    const insert = connection.calls.find((c) => /INSERT INTO ticket_sla_events/.test(c.sql));
    expect(insert?.params?.[2]).toBe('sla_resumed');
  });

  it('no hace nada al pasar de un estado de espera a otro (sigue pausado)', async () => {
    const connection = mockConnection({ ticket: { sla_policy_id: 2, sla_paused_since: new Date() } });
    await applySlaPauseTransition(connection, 10, 'ON_HOLD_USER', 'ON_HOLD_VENDOR');
    expect(connection.query).not.toHaveBeenCalled();
  });

  it('no hace nada entre dos estados activos', async () => {
    const connection = mockConnection({ ticket: {} });
    await applySlaPauseTransition(connection, 10, 'NEW', 'ASSIGNED');
    expect(connection.query).not.toHaveBeenCalled();
  });

  it('no pausa un ticket sin política de SLA que proteger', async () => {
    const connection = mockConnection({ ticket: { sla_policy_id: null, sla_paused_since: null } });
    await applySlaPauseTransition(connection, 10, 'IN_PROGRESS', 'ON_HOLD_USER');
    expect(connection.calls.some((c) => /UPDATE tickets/.test(c.sql) || /INSERT INTO ticket_sla_events/.test(c.sql))).toBe(false);
  });

  it('trata la primera transición (fromStatusCode null, ticket recién creado) como no pausada', async () => {
    const connection = mockConnection({ ticket: { sla_policy_id: 2, sla_paused_since: null } });
    await applySlaPauseTransition(connection, 10, null, 'ASSIGNED');
    expect(connection.query).not.toHaveBeenCalled();
  });

  it('conoce exactamente los dos códigos de espera del esquema', () => {
    expect(ON_HOLD_STATUS_CODES).toEqual(new Set(['ON_HOLD_USER', 'ON_HOLD_VENDOR']));
  });
});
