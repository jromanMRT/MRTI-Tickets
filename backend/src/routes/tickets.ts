import { Router } from 'express';
import pool from '../config/db';
import { requireAuth } from '../middlewares/auth';
import { createTicket } from '../services/ticketService';
import { logAudit } from '../services/audit';
import { getTicketContext } from '../integrations/coreClient';
import { getTicketAreaScope, requireTicketAreaAccess, validateTicketClassification } from '../services/ticketAreaAccess';
import { sendTicketCreationLimitError, withTicketCreationPermission } from '../services/ticketCreationLimits';
import { validateAssetUid } from '../integrations/activosClient';
import { applySlaPauseTransition } from '../services/slaService';
import { SLA_DEADLINE_SQL, TERMINAL_TICKET_STATUS_CODES_SQL, slaIsAtRiskSql, slaIsOverdueSql, slaStateCaseSql } from '../services/slaSql';

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
  const areaScope = await getTicketAreaScope(req.user);
  const clauses = ['t.deleted_at IS NULL', areaScope.sql];
  const params: Array<string | number> = [...areaScope.params];

  if (req.query.status) {
    clauses.push('s.code = ?');
    params.push(String(req.query.status));
  }
  if (req.query.priority) {
    clauses.push('t.priority_code = ?');
    params.push(String(req.query.priority));
  }
  if (req.query.business_area_id) {
    clauses.push('COALESCE(t.business_area_id, c.business_area_id) = ?');
    params.push(String(req.query.business_area_id));
  }
  if (req.query.assigned_to) {
    clauses.push('t.assigned_to = ?');
    params.push(String(req.query.assigned_to));
  }
  if (req.query.asset_uid) {
    clauses.push('t.asset_uid = ?');
    params.push(String(req.query.asset_uid));
  }
  const terminalStatuses = TERMINAL_TICKET_STATUS_CODES_SQL;
  const scope = String(req.query.scope || '');
  if (scope === 'open') clauses.push(`s.code NOT IN (${terminalStatuses})`);
  if (scope === 'mine') {
    clauses.push(`t.assigned_to = ? AND s.code NOT IN (${terminalStatuses})`);
    params.push(String(req.user?.id || ''));
  }
  if (scope === 'unassigned') clauses.push(`t.assigned_to IS NULL AND s.code NOT IN (${terminalStatuses})`);
  if (scope === 'overdue') clauses.push(`s.code NOT IN (${terminalStatuses}) AND ${slaIsOverdueSql()}`);
  if (scope === 'at-risk') clauses.push(`s.code NOT IN (${terminalStatuses}) AND ${slaIsAtRiskSql()}`);
  if (scope === 'paused') clauses.push(`s.code NOT IN (${terminalStatuses}) AND t.sla_paused_since IS NOT NULL`);
  if (req.query.q) {
    clauses.push('(t.folio LIKE ? OR t.title LIKE ? OR t.requester_name LIKE ? OR t.origin_area_name LIKE ? OR t.affected_device_internal_id LIKE ?)');
    const search = `%${String(req.query.q).trim()}%`;
    params.push(search, search, search, search, search);
  }

  const where = `WHERE ${clauses.join(' AND ')}`;
  const sortOptions: Record<string, string> = {
    newest: 't.created_at DESC',
    updated: 't.updated_at DESC',
    oldest: 't.created_at ASC',
    priority: "FIELD(t.priority_code, 'P1','P2','P3','P4'), t.created_at ASC",
    sla: "COALESCE(sla_deadline_effective, '9999-12-31') ASC",
  };
  const orderBy = sortOptions[String(req.query.sort || '')] || sortOptions.updated;
  try {
    const [rows] = await pool.query(
      `SELECT t.id, t.folio, t.title, t.priority_code, t.assigned_to,
              t.assigned_to_name, t.requester_name, t.created_at, t.updated_at,
              t.origin_area_name, t.origin_site_name, t.affected_device_internal_id,
              t.affected_device_name, t.asset_uid,
              s.code AS status_code, s.name AS status_name,
              p.name AS priority_name,
              COALESCE(t.business_area_id, c.business_area_id) AS business_area_id, b.name AS business_area_name,
              ${SLA_DEADLINE_SQL} AS sla_deadline_effective,
              (t.sla_paused_since IS NOT NULL) AS sla_is_paused,
              ${slaStateCaseSql(terminalStatuses)} AS sla_state,
              (SELECT COUNT(*) FROM ticket_comments tc WHERE tc.ticket_id = t.id) AS comment_count,
              (SELECT COUNT(*) FROM ticket_attachments ta WHERE ta.ticket_id = t.id) AS attachment_count
         FROM tickets t
         JOIN ticket_statuses s ON s.id = t.status_id
         LEFT JOIN ticket_priorities p ON p.code = t.priority_code
         LEFT JOIN ticket_categories c ON c.id = t.category_id
         LEFT JOIN business_areas b ON b.id = COALESCE(t.business_area_id, c.business_area_id)
         LEFT JOIN sla_policies sp ON sp.id = t.sla_policy_id
         ${where}
        ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[countRow]]: any = await pool.query(
      `SELECT COUNT(*) AS total FROM tickets t
       JOIN ticket_statuses s ON s.id = t.status_id
       LEFT JOIN ticket_categories c ON c.id = t.category_id
       LEFT JOIN sla_policies sp ON sp.id = t.sla_policy_id
       ${where}`,
      params
    );
    const total = Number(countRow.total);
    res.json({ success: true, data: { items: rows, page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error al consultar tickets' } });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { title, description, business_area_id, category_id, subcategory_id, priority_code } = req.body;
  if (!String(title || '').trim()) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'El título es requerido' } });
  }
  const areaId = Number(business_area_id);
  const categoryId = Number(category_id);
  const subcategoryId = subcategory_id ? Number(subcategory_id) : null;
  if (!areaId || !categoryId) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Selecciona el área y la categoría del ticket' } });
  }
  try {
    const classification = await validateTicketClassification(areaId, categoryId, subcategoryId);
    if (!classification.valid) {
      return res.status(400).json({ success: false, error: { code: classification.code, message: classification.message } });
    }
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

    // asset_uid es opcional (ej. botón "Crear ticket" desde el popup de un
    // activo en MRTI-Activos) -- si viene, se valida contra Activos antes de
    // guardarlo; "no existe" se rechaza, "Activos no disponible" no bloquea
    // la creación (se guarda sin verificar, ver activosClient.ts).
    const requestedAssetUid = String(req.body.asset_uid || '').trim() || null;
    if (requestedAssetUid) {
      const validation = await validateAssetUid(requestedAssetUid, { userToken: bearerToken(req) });
      if (validation.status === 'not_found') {
        return res.status(400).json({ success: false, error: { code: 'ASSET_NOT_FOUND', message: 'El activo indicado no existe' } });
      }
    }

    const ticket = await withTicketCreationPermission(String(req.user?.id || ''), () => createTicket({
      title: String(title).trim(),
      description: String(description || '').trim() || null,
      business_area_id: areaId,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      categories: [{ category_id: categoryId, subcategory_id: subcategoryId }],
      related_device_id: affectedDevice?.id || null,
      asset_number: affectedDevice?.inventory_tag || affectedDevice?.internal_id || null,
      asset_uid: requestedAssetUid,
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
    }));
    await logAudit(req.user?.id || null, req.user?.name || null, 'ticket.create', 'ticket', ticket.id, null, ticket);
    res.status(201).json({ success: true, data: ticket, message: 'Ticket creado correctamente' });
  } catch (err) {
    console.error(err);
    if (sendTicketCreationLimitError(res, err)) return;
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error al crear el ticket' } });
  }
});

router.get('/:id', requireAuth, requireTicketAreaAccess, async (req, res) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT t.*, s.code AS status_code, s.name AS status_name,
              c.name AS category_name, p.name AS priority_name,
              COALESCE(t.business_area_id, c.business_area_id) AS business_area_id, b.name AS business_area_name
         FROM tickets t
         JOIN ticket_statuses s ON s.id = t.status_id
         LEFT JOIN ticket_categories c ON c.id = t.category_id
         LEFT JOIN ticket_priorities p ON p.code = t.priority_code
         LEFT JOIN business_areas b ON b.id = COALESCE(t.business_area_id, c.business_area_id)
        WHERE t.id = ? AND t.deleted_at IS NULL LIMIT 1`,
      [Number(req.params.id)]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: { code: 'TICKET_NOT_FOUND', message: 'No se encontró el ticket' } });
    const [categoryLinks]: any = await pool.query(
      `SELECT l.category_id, c.name AS category_name, c.business_area_id, b.name AS business_area_name,
              l.subcategory_id, sc.name AS subcategory_name
         FROM ticket_category_links l
         JOIN ticket_categories c ON c.id = l.category_id
         LEFT JOIN business_areas b ON b.id = c.business_area_id
         LEFT JOIN ticket_subcategories sc ON sc.id = l.subcategory_id
        WHERE l.ticket_id = ?
        ORDER BY b.sort_order, c.sort_order`,
      [Number(req.params.id)]
    );
    res.json({ success: true, data: { ...rows[0], categories: categoryLinks } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error al consultar el ticket' } });
  }
});

router.patch('/:id/status', requireAuth, requireTicketAreaAccess, async (req, res) => {
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
    const [currentRows]: any = await connection.query(
      `SELECT t.status_id, s.code AS status_code FROM tickets t JOIN ticket_statuses s ON s.id = t.status_id WHERE t.id = ? AND t.deleted_at IS NULL LIMIT 1`,
      [ticketId]
    );
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
    // Pausar/reanudar el SLA es parte del mismo cambio de estado: se
    // confirma o se revierte junto con él (ver services/slaService.ts).
    await applySlaPauseTransition(connection, ticketId, currentRows[0].status_code, String(to_status_code));
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
