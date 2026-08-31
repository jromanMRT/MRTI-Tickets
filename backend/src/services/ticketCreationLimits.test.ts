import { describe, expect, it } from 'vitest';
import { evaluateTicketCreationLimit, TicketCreationLimitError } from './ticketCreationLimits';

const policy = { user_id: 'user-1', hourly_limit: 3, daily_limit: 10, creation_blocked: false };

describe('evaluateTicketCreationLimit', () => {
  it('permite crear por debajo de ambos límites', () => {
    expect(() => evaluateTicketCreationLimit(policy, { hourly_count: 2, daily_count: 9 })).not.toThrow();
  });

  it('bloquea antes de considerar los conteos', () => {
    expect(() => evaluateTicketCreationLimit({ ...policy, creation_blocked: true }, { hourly_count: 0, daily_count: 0 }))
      .toThrowError(expect.objectContaining({ code: 'TICKET_CREATION_BLOCKED', status: 403 }));
  });

  it('aplica los límites por hora y por 24 horas', () => {
    for (const [counts, code] of [
      [{ hourly_count: 3, daily_count: 3 }, 'TICKET_HOURLY_LIMIT'],
      [{ hourly_count: 1, daily_count: 10 }, 'TICKET_DAILY_LIMIT'],
    ] as const) {
      try {
        evaluateTicketCreationLimit(policy, counts);
        throw new Error('Debió limitar la creación');
      } catch (error) {
        expect(error).toBeInstanceOf(TicketCreationLimitError);
        expect((error as TicketCreationLimitError).code).toBe(code);
      }
    }
  });
});
