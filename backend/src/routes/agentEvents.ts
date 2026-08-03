import { Router } from 'express';
import pool from '../config/db';
import { createTicket } from '../services/ticketService';
import { getDeviceInfo } from '../integrations/mrtiInfraClient';
import { sendNotification } from '../integrations/coreNotifications';
import { requireAuth } from '../middlewares/auth';

const router = Router();

async function authAgentOrUser(req: any, res: any, next: any) {
  const key = req.headers['x-agent-key'] || req.headers['x-api-key'];
  if (process.env.AGENT_API_KEY && key && key === process.env.AGENT_API_KEY) {
    req.user = { system: true };
    return next();
  }
  // fallback to Core auth
  return requireAuth(req, res, next);
}

router.post('/', authAgentOrUser, async (req, res) => {
  const payload = req.body || {};
  const deviceId = payload.device_id || payload.deviceId || null;
  const eventType = payload.event_type || payload.type || 'unknown';
  const component = payload.component || payload.component_name || '';
  const message = payload.message || payload.msg || '';
  const severity = (payload.severity || 'medium').toLowerCase();

  if (!deviceId) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'device_id required' } });

  const fingerprint = `${deviceId}|${eventType}|${component}`;

  try {
    // lookup existing correlation
    const [corrRows]: any = await pool.query('SELECT id, fingerprint, ticket_id, occurrences FROM automatic_event_correlations WHERE fingerprint = ? LIMIT 1', [fingerprint]);
    const correlation = corrRows && corrRows[0] ? corrRows[0] : null;

    // determine priority by severity
    const priorityMap: any = { critical: 'P1', high: 'P2', medium: 'P3', low: 'P4' };
    const priority = priorityMap[severity] || 'P3';

    // fetch device info to include in description
    const deviceInfo = await getDeviceInfo(Number(deviceId));
    const deviceSummary = deviceInfo ? `Equipo: ${deviceInfo.name || deviceId} (asset: ${deviceInfo.asset_number || ''}, ip: ${deviceInfo.ip || ''})\n` : `Equipo id: ${deviceId}\n`;

    // if correlation exists and has ticket_id, append as comment if ticket active
    if (correlation && correlation.ticket_id) {
      const [trows]: any = await pool.query('SELECT t.id, s.code as status_code FROM tickets t JOIN ticket_statuses s ON t.status_id = s.id WHERE t.id = ? LIMIT 1', [correlation.ticket_id]);
      const tinfo = trows && trows[0] ? trows[0] : null;
      if (tinfo && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(tinfo.status_code)) {
        // add comment
        await pool.query('INSERT INTO ticket_comments (ticket_id, author_id, author_name, is_private, content) VALUES (?,?,?,?,?)', [correlation.ticket_id, null, 'mrti-agent', 1, `Evento agregado por agente:\n${deviceSummary}\nTipo: ${eventType}\nComponente: ${component}\nSeveridad: ${severity}\nMensaje: ${message}`]);
        await pool.query('UPDATE automatic_event_correlations SET occurrences = occurrences + 1, last_seen = NOW(), ticket_id = ? WHERE id = ?', [correlation.ticket_id, correlation.id]);
        return res.json({ success: true, data: { ticket_id: correlation.ticket_id, message: 'Evento agregado al ticket existente' } });
      }
    }

    // else create a new ticket
    const title = `Alerta agente: ${eventType} - equipo ${deviceId}`;
    const description = `${deviceSummary}\nMensaje: ${message}\nComponente: ${component}\nSeveridad: ${severity}\nPayload: ${JSON.stringify(payload)}`;

    const ticket = await createTicket({ title, description, related_device_id: String(deviceId), priority_code: priority, created_by: null });

    if (correlation) {
      await pool.query('UPDATE automatic_event_correlations SET ticket_id = ?, occurrences = occurrences + 1, last_seen = NOW() WHERE id = ?', [ticket.id, correlation.id]);
    } else {
      await pool.query('INSERT INTO automatic_event_correlations (device_id, event_type, fingerprint, ticket_id, last_seen, occurrences) VALUES (?,?,?,?,NOW(),?)', [Number(deviceId), eventType, fingerprint, ticket.id, 1]);
    }

    // add an initial comment with agent event
    await pool.query('INSERT INTO ticket_comments (ticket_id, author_id, author_name, is_private, content) VALUES (?,?,?,?,?)', [ticket.id, null, 'mrti-agent', 1, `Ticket generado automáticamente por agente:\n${deviceSummary}\nTipo: ${eventType}\nComponente: ${component}\nSeveridad: ${severity}\nMensaje: ${message}`]);

    // send notification to Core
    try {
      await sendNotification('ticket.created', { ticket_id: ticket.id, folio: ticket.folio, source: 'agent', device_id: deviceId });
    } catch {
      // ignore
    }

    res.status(201).json({ success: true, data: { ticket_id: ticket.id, folio: ticket.folio } });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('agent events error', err);
    res.status(500).json({ success: false, error: { code: 'AGENT_ERROR', message: 'Error processing agent event' } });
  }
});

export default router;
