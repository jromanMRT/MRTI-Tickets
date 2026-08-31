import pool from '../config/db';

export interface TicketCreationPolicy {
  user_id: string;
  hourly_limit: number | null;
  daily_limit: number | null;
  creation_blocked: boolean;
}

export interface TicketCreationCounts {
  hourly_count: number;
  daily_count: number;
}

export class TicketCreationLimitError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function evaluateTicketCreationLimit(policy: TicketCreationPolicy, counts: TicketCreationCounts) {
  if (policy.creation_blocked) {
    throw new TicketCreationLimitError(403, 'TICKET_CREATION_BLOCKED', 'Tu cuenta no tiene permitido crear tickets. Contacta a un administrador.');
  }
  if (policy.hourly_limit !== null && counts.hourly_count >= policy.hourly_limit) {
    throw new TicketCreationLimitError(429, 'TICKET_HOURLY_LIMIT', `Alcanzaste el límite de ${policy.hourly_limit} ticket(s) en una hora. Intenta más tarde.`);
  }
  if (policy.daily_limit !== null && counts.daily_count >= policy.daily_limit) {
    throw new TicketCreationLimitError(429, 'TICKET_DAILY_LIMIT', `Alcanzaste el límite de ${policy.daily_limit} ticket(s) en 24 horas. Intenta más tarde.`);
  }
}

export async function withTicketCreationPermission<T>(userId: string, create: () => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  const lockName = `mrti-ticket-create:${userId}`.slice(0, 64);
  let locked = false;
  try {
    const [[lock]]: any = await connection.query('SELECT GET_LOCK(?, 5) AS acquired', [lockName]);
    locked = Number(lock?.acquired) === 1;
    if (!locked) throw new TicketCreationLimitError(503, 'TICKET_LIMIT_LOCK_TIMEOUT', 'No fue posible validar el límite de tickets. Intenta nuevamente.');

    const [policies]: any = await connection.query(
      'SELECT user_id, hourly_limit, daily_limit, creation_blocked FROM ticket_user_creation_limits WHERE user_id = ? LIMIT 1',
      [userId]
    );
    if (policies.length) {
      const policy: TicketCreationPolicy = {
        ...policies[0],
        hourly_limit: policies[0].hourly_limit === null ? null : Number(policies[0].hourly_limit),
        daily_limit: policies[0].daily_limit === null ? null : Number(policies[0].daily_limit),
        creation_blocked: Boolean(policies[0].creation_blocked),
      };
      const [[counts]]: any = await connection.query(
        `SELECT
           SUM(created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 HOUR)) AS hourly_count,
           SUM(created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR)) AS daily_count
           FROM tickets WHERE requester_id = ?`,
        [userId]
      );
      evaluateTicketCreationLimit(policy, {
        hourly_count: Number(counts?.hourly_count || 0),
        daily_count: Number(counts?.daily_count || 0),
      });
    }
    return await create();
  } finally {
    if (locked) await connection.query('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => undefined);
    connection.release();
  }
}

export function sendTicketCreationLimitError(res: any, error: unknown): boolean {
  if (!(error instanceof TicketCreationLimitError)) return false;
  res.status(error.status).json({ success: false, error: { code: error.code, message: error.message } });
  return true;
}
