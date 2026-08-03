import pool from '../config/db';

type SLAStatus = {
  elapsedMinutes: number;
  remainingMinutes: number | null;
  percentConsumed: number | null;
  state: 'En tiempo' | 'En riesgo' | 'Vencido' | 'Pausado' | 'Cumplido' | 'Sin SLA';
  deadline: string | null;
};

export async function getSlaStatusForTicket(ticketId: number): Promise<SLAStatus> {
  const [ticketRows]: any = await pool.query('SELECT t.created_at, t.sla_policy_id, t.status_id FROM tickets t WHERE t.id = ? LIMIT 1', [ticketId]);
  if (!ticketRows || ticketRows.length === 0) return { elapsedMinutes: 0, remainingMinutes: null, percentConsumed: null, state: 'Sin SLA', deadline: null };
  const ticket = ticketRows[0];

  if (!ticket.sla_policy_id) return { elapsedMinutes: 0, remainingMinutes: null, percentConsumed: null, state: 'Sin SLA', deadline: null };

  const [policyRows]: any = await pool.query('SELECT id, name, priority_code, first_response_minutes, resolution_minutes FROM sla_policies WHERE id = ? LIMIT 1', [ticket.sla_policy_id]);
  if (!policyRows || policyRows.length === 0) return { elapsedMinutes: 0, remainingMinutes: null, percentConsumed: null, state: 'Sin SLA', deadline: null };
  const policy = policyRows[0];

  const createdAt = new Date(ticket.created_at);
  const now = new Date();
  const elapsedMs = now.getTime() - createdAt.getTime();
  const elapsedMinutes = Math.floor(elapsedMs / 60000);

  const resolution = Number(policy.resolution_minutes);
  const remaining = resolution - elapsedMinutes;
  const percent = resolution > 0 ? Math.min(100, Math.round((elapsedMinutes / resolution) * 100)) : null;

  // get status code
  const [statusRows]: any = await pool.query('SELECT code FROM ticket_statuses WHERE id = ? LIMIT 1', [ticket.status_id]);
  const statusCode = statusRows && statusRows[0] ? statusRows[0].code : null;

  let state: SLAStatus['state'] = 'En tiempo';
  if (statusCode === 'RESOLVED' || statusCode === 'CLOSED') state = 'Cumplido';
  else if (remaining <= 0) state = 'Vencido';
  else if (percent !== null && percent >= 80) state = 'En riesgo';
  else state = 'En tiempo';

  const deadlineDate = new Date(createdAt.getTime() + resolution * 60 * 1000);

  return { elapsedMinutes, remainingMinutes: remaining, percentConsumed: percent, state, deadline: deadlineDate.toISOString() };
}
