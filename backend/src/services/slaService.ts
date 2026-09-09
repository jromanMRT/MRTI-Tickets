import pool from '../config/db';
import { TERMINAL_TICKET_STATUS_CODES } from './slaSql';

type SLAStatus = {
  elapsedMinutes: number;
  pausedMinutes: number;
  remainingMinutes: number | null;
  percentConsumed: number | null;
  state: 'En tiempo' | 'En riesgo' | 'Vencido' | 'Pausado' | 'Cumplido' | 'Sin SLA';
  deadline: string | null;
};

// Un ticket en espera del usuario o de un proveedor no debe seguir
// consumiendo su SLA -- work_hours/include_holidays existen en sla_policies
// pero nadie los ha configurado nunca (siempre NULL / TRUE por defecto), así
// que no se inventa aquí un calendario de horario laboral sin esa
// configuración real; esto sólo resuelve la pausa explícita por estado.
export const ON_HOLD_STATUS_CODES = new Set(['ON_HOLD_USER', 'ON_HOLD_VENDOR']);

export async function getSlaStatusForTicket(ticketId: number): Promise<SLAStatus> {
  const empty: SLAStatus = { elapsedMinutes: 0, pausedMinutes: 0, remainingMinutes: null, percentConsumed: null, state: 'Sin SLA', deadline: null };
  const [ticketRows]: any = await pool.query(
    'SELECT t.created_at, t.sla_policy_id, t.status_id, t.sla_paused_minutes, t.sla_paused_since FROM tickets t WHERE t.id = ? LIMIT 1',
    [ticketId]
  );
  if (!ticketRows || ticketRows.length === 0) return empty;
  const ticket = ticketRows[0];

  if (!ticket.sla_policy_id) return empty;

  const [policyRows]: any = await pool.query('SELECT id, name, priority_code, first_response_minutes, resolution_minutes FROM sla_policies WHERE id = ? LIMIT 1', [ticket.sla_policy_id]);
  if (!policyRows || policyRows.length === 0) return empty;
  const policy = policyRows[0];

  const createdAt = new Date(ticket.created_at);
  const now = new Date();
  const elapsedMinutes = Math.floor((now.getTime() - createdAt.getTime()) / 60000);

  const isPausedNow = Boolean(ticket.sla_paused_since);
  const livePauseMinutes = isPausedNow
    ? Math.max(0, Math.floor((now.getTime() - new Date(ticket.sla_paused_since).getTime()) / 60000))
    : 0;
  const pausedMinutes = Number(ticket.sla_paused_minutes || 0) + livePauseMinutes;

  const resolution = Number(policy.resolution_minutes);
  const effectiveElapsed = elapsedMinutes - pausedMinutes;
  const remaining = resolution - effectiveElapsed;
  const percent = resolution > 0 ? Math.min(100, Math.max(0, Math.round((effectiveElapsed / resolution) * 100))) : null;

  const [statusRows]: any = await pool.query('SELECT code FROM ticket_statuses WHERE id = ? LIMIT 1', [ticket.status_id]);
  const statusCode = statusRows && statusRows[0] ? statusRows[0].code : null;

  let state: SLAStatus['state'];
  if ((TERMINAL_TICKET_STATUS_CODES as readonly string[]).includes(statusCode)) state = 'Cumplido';
  else if (isPausedNow) state = 'Pausado';
  else if (remaining <= 0) state = 'Vencido';
  else if (percent !== null && percent >= 80) state = 'En riesgo';
  else state = 'En tiempo';

  const deadlineDate = new Date(createdAt.getTime() + (resolution + pausedMinutes) * 60 * 1000);

  return { elapsedMinutes: effectiveElapsed, pausedMinutes, remainingMinutes: remaining, percentConsumed: percent, state, deadline: deadlineDate.toISOString() };
}

// Se llama dentro de la misma transacción que ya escribe
// ticket_status_history (ver PATCH /tickets/:id/status), así que un cambio
// de estado y su efecto sobre el SLA siempre se confirman o se revierten
// juntos. No hace nada si ninguno de los dos estados es "en espera" (evita
// resetear la pausa en una transición espera->espera, p. ej. de usuario a
// proveedor) ni si el ticket no tiene una política de SLA que proteger.
export async function applySlaPauseTransition(
  connection: { query: (sql: string, params?: any[]) => Promise<any> },
  ticketId: number,
  fromStatusCode: string | null,
  toStatusCode: string
): Promise<void> {
  const wasPaused = fromStatusCode !== null && ON_HOLD_STATUS_CODES.has(fromStatusCode);
  const isPaused = ON_HOLD_STATUS_CODES.has(toStatusCode);
  if (wasPaused === isPaused) return;

  const [[ticket]]: any = await connection.query('SELECT sla_policy_id, sla_paused_since FROM tickets WHERE id = ? LIMIT 1', [ticketId]);
  if (!ticket || !ticket.sla_policy_id) return;

  const meta = JSON.stringify({ from_status_code: fromStatusCode, to_status_code: toStatusCode });

  if (isPaused) {
    await connection.query('UPDATE tickets SET sla_paused_since = NOW() WHERE id = ?', [ticketId]);
    await connection.query(
      'INSERT INTO ticket_sla_events (ticket_id, sla_policy_id, event_type, meta) VALUES (?,?,?,?)',
      [ticketId, ticket.sla_policy_id, 'sla_paused', meta]
    );
    return;
  }

  if (!ticket.sla_paused_since) return; // defensivo: no había una pausa registrada
  await connection.query(
    `UPDATE tickets
        SET sla_paused_minutes = sla_paused_minutes + GREATEST(TIMESTAMPDIFF(MINUTE, sla_paused_since, NOW()), 0),
            sla_paused_since = NULL
      WHERE id = ?`,
    [ticketId]
  );
  await connection.query(
    'INSERT INTO ticket_sla_events (ticket_id, sla_policy_id, event_type, meta) VALUES (?,?,?,?)',
    [ticketId, ticket.sla_policy_id, 'sla_resumed', meta]
  );
}
