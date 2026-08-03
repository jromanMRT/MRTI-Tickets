import { Router } from 'express';
import pool from '../config/db';
import { requireAuth } from '../middlewares/auth';
import { createTicket } from '../services/ticketService';
import { logAudit } from '../services/audit';
import { getTicketContext } from '../integrations/coreClient';

const router = Router();

function bearerToken(req: any) {
  const header = String(req.headers.authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

router.get('/context', requireAuth, async (req, res) => {
  try {
    const context = await getTicketContext(bearerToken(req));
    res.json({ success: true, data: context || { location: null, primary_device: null, area_devices: [] } });
  } catch (err) {
    console.error(err);
    res.status(502).json({ success: false, error: { code: 'CONTEXT_ERROR', message: 'No se pudo consultar la ubicación del usuario' } });
  }
});

router.get('/', requireAuth, async (req, res) => {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 100);
  const offset = (page - 1) * limit;
  const clauses = ['t.deleted_at IS NULL'];
  const params: Array<string | number> = [];

  if (req.query.status) {
    clauses.push('s.code = ?');
    params.push(String(req.query.status));
  }
  if (req.query.priority) {
    clauses.push('t.priority_code = ?');
    params.push(String(req.query.priority));
  }
  if (req.query.q) {
    clauses.push('(t.folio LIKE ? OR t.title LIKE ? OR t.origin_area_name LIKE ? OR t.affected_device_internal_id LIKE ?)');
    const search = `%${String(req.query.q).trim()}%`;
    params.push(search, search, search, search);
  }

  const where = `WHERE ${clauses.join(' AND ')}`;
  try {
    const [rows] = await pool.query(
      `SELECT t.id, t.folio, t.title, t.priority_code, t.assigned_to,
              t.assigned_to_name, t.requester_name, t.created_at, t.updated_at,
              t.origin_area_name, t.origin_site_name, t.affected_device_internal_id,
              t.affected_device_name,
              s.code AS status_code, s.name AS status_name,
              p.name AS priority_name
         FROM tickets t
         JOIN ticket_statuses s ON s.id = t.status_id
         LEFT JOIN ticket_priorities p ON p.code = t.priority_code
         ${where}
        ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[countRow]]: any = await pool.query(
      `SELECT COUNT(*) AS total FROM tickets t
       JOIN ticket_statuses s ON s.id = t.status_id ${where}`,
      params
    );
    res.json({ success: true, data: { items: rows, page, limit, total: Number(countRow.total) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error al consultar tickets' } });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { title, description, category_id, priority_code } = req.body;
  if (!String(title || '').trim()) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'El título es requerido' } });
  }
  try {
    const context = await getTicketContext(bearerToken(req));
    const requestedDeviceId = String(req.body.affected_device_id || req.body.related_device_id || context?.primary_device?.id || '').trim() || null;
    const affectedDevice = requestedDeviceId
      ? context?.area_devices?.find((device: any) => device.id === requestedDeviceId)
      : null;
    if (requestedDeviceId && !affectedDevice) {
      return res.status(400).json({ success: false, error: { code: 'DEVICE_OUTSIDE_AREA', message: 'El equipo afectado no pertenece al área física del usuario' } });
    }
    const primaryDevice = context?.primary_device || null;
    const location = context?.location || null;
    const ticket = await createTicket({
      title: String(title).trim(),
      description: String(description || '').trim() || null,
      category_id: category_id ? Number(category_id) : null,
      related_device_id: affectedDevice?.id || null,
      asset_number: affectedDevice?.inventory_tag || affectedDevice?.internal_id || null,
      priority_code: priority_code || 'P3',
      requester_id: req.user?.id || null,
      requester_name: req.user?.name || req.user?.full_name || null,
      requester_email: req.user?.email || null,
      requester_number: Number(context?.requester_number || req.user?.user_number) || null,
      requester_device_id: primaryDevice?.id || null,
      requester_device_internal_id: primaryDevice?.internal_id || null,
      requester_device_name: primaryDevice?.name || null,
      affected_device_internal_id: affectedDevice?.internal_id || null,
      affected_device_name: affectedDevice?.name || null,
      origin_site_id: location?.site_id || null,
      origin_site_name: location?.site_name || null,
      origin_building_name: location?.building_name || null,
      origin_floor_name: location?.floor_name || null,
      origin_area_id: location?.area_id || null,
      origin_area_name: location?.area_name || null,
      created_by: req.user?.id || null,
    });
    await logAudit(req.user?.id || null, req.user?.name || null, 'ticket.create', 'ticket', ticket.id, null, ticket);
    res.status(201).json({ success: true, data: ticket, message: 'Ticket creado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error al crear el ticket' } });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT t.*, s.code AS status_code, s.name AS status_name,
              c.name AS category_name, p.name AS priority_name
         FROM tickets t
         JOIN ticket_statuses s ON s.id = t.status_id
         LEFT JOIN ticket_categories c ON c.id = t.category_id
         LEFT JOIN ticket_priorities p ON p.code = t.priority_code
        WHERE t.id = ? AND t.deleted_at IS NULL LIMIT 1`,
      [Number(req.params.id)]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: { code: 'TICKET_NOT_FOUND', message: 'No se encontró el ticket' } });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error al consultar el ticket' } });
  }
});

router.patch('/:id/status', requireAuth, async (req, res) => {
  const ticketId = Number(req.params.id);
  const { to_status_code, comment } = req.body;
  if (!to_status_code) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Selecciona un estado' } });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [statusRows]: any = await connection.query('SELECT id FROM ticket_statuses WHERE code = ? LIMIT 1', [to_status_code]);
    if (!statusRows.length) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: 'Estado inválido' } });
    }
    const [currentRows]: any = await connection.query('SELECT status_id FROM tickets WHERE id = ? AND deleted_at IS NULL LIMIT 1', [ticketId]);
    if (!currentRows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: { code: 'TICKET_NOT_FOUND', message: 'No se encontró el ticket' } });
    }
    const toStatusId = statusRows[0].id;
    await connection.query('UPDATE tickets SET status_id = ? WHERE id = ?', [toStatusId, ticketId]);
    await connection.query(
      'INSERT INTO ticket_status_history (ticket_id, from_status_id, to_status_id, changed_by, comment) VALUES (?,?,?,?,?)',
      [ticketId, currentRows[0].status_id, toStatusId, req.user?.id || null, comment || null]
    );
    await connection.commit();
    res.json({ success: true, message: 'Estado actualizado' });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error al actualizar el estado' } });
  } finally {
    connection.release();
  }
});

export default router;
