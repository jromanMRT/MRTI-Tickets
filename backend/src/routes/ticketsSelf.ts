import { Router } from 'express';
import pool from '../config/db';
import { requireCoreAuth } from '../middlewares/auth';
import { getTicketContext } from '../integrations/coreClient';
import { createTicket } from '../services/ticketService';
import { logAudit } from '../services/audit';
import { validateTicketClassification } from '../services/ticketAreaAccess';
import { listTeamTicketNotifications } from '../services/teamNotifications';
import { selfTicketEditState } from '../services/selfTicketEditing';
import { sendTicketCreationLimitError, withTicketCreationPermission } from '../services/ticketCreationLimits';

const router = Router();

// Autoservicio (Fase 7 de CORE_INFRA_MIGRATION_GUIDE.md): tickets propios
// (creados o asignados), para el dashboard personal de Core — no requiere
// abrir el módulo administrativo de Tickets.
function bearerToken(req: any) {
  return String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
}

const selfTicketSelect = `SELECT t.id, t.folio, t.title, t.description, t.priority_code, t.assigned_to, t.assigned_to_name,
              t.requester_id, t.requester_name, t.created_at, t.updated_at,
              s.code AS status_code, s.name AS status_name,
              p.name AS priority_name, c.name AS category_name,
              sc.name AS subcategory_name, b.name AS business_area_name
         FROM tickets t
         JOIN ticket_statuses s ON s.id = t.status_id
         LEFT JOIN ticket_priorities p ON p.code = t.priority_code
         LEFT JOIN ticket_categories c ON c.id = t.category_id
         LEFT JOIN ticket_subcategories sc ON sc.id = t.subcategory_id
         LEFT JOIN business_areas b ON b.id = COALESCE(t.business_area_id, c.business_area_id)`;

function serializeSelfTicket(ticket: any, userId: string) {
  return { ...ticket, ...selfTicketEditState(ticket, userId) };
}

router.get('/options', requireCoreAuth, async (_req, res) => {
  try {
    const [businessAreas]: any = await pool.query(
      'SELECT id, name, code FROM business_areas WHERE active = 1 ORDER BY sort_order, name'
    );
    const [categories]: any = await pool.query(
      `SELECT id, name, code, business_area_id
         FROM ticket_categories
        WHERE active = 1
        ORDER BY sort_order, name`
    );
    const [subcategories]: any = await pool.query(
      `SELECT id, category_id, name, code
         FROM ticket_subcategories
        WHERE active = 1
        ORDER BY category_id, sort_order, name`
    );
    const [priorities]: any = await pool.query(
      'SELECT code, name, level FROM ticket_priorities ORDER BY level'
    );
    res.json({ success: true, data: { business_areas: businessAreas, categories, subcategories, priorities } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error al cargar las opciones del ticket' } });
  }
});

router.get('/me', requireCoreAuth, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Token missing' } });
  }
  try {
    const [rows]: any = await pool.query(
      `${selfTicketSelect}
        WHERE t.deleted_at IS NULL AND (t.requester_id = ? OR t.assigned_to = ?)
        ORDER BY t.created_at DESC LIMIT 20`,
      [userId, userId]
    );
    res.json({ success: true, data: rows.map((ticket: any) => serializeSelfTicket(ticket, String(userId))) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error al consultar tus tickets' } });
  }
});

router.get('/me/:id', requireCoreAuth, async (req, res) => {
  const userId = String(req.user?.id || '');
  try {
    const [rows]: any = await pool.query(
      `${selfTicketSelect}
        WHERE t.id = ? AND t.deleted_at IS NULL AND (t.requester_id = ? OR t.assigned_to = ?)
        LIMIT 1`,
      [req.params.id, userId, userId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket no encontrado' } });
    return res.json({ success: true, data: serializeSelfTicket(rows[0], userId) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error al consultar el ticket' } });
  }
});

router.patch('/me/:id', requireCoreAuth, async (req, res) => {
  const userId = String(req.user?.id || '');
  const title = String(req.body?.title || '').trim();
  const description = String(req.body?.description || '').trim();
  if (!title || title.length > 255) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'El título debe tener entre 1 y 255 caracteres' } });
  }
  if (description.length > 10000) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'La descripción no puede exceder 10,000 caracteres' } });
  }
  try {
    const [rows]: any = await pool.query('SELECT id, folio, title, description, requester_id, created_at FROM tickets WHERE id = ? AND deleted_at IS NULL LIMIT 1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket no encontrado' } });
    const before = rows[0];
    const editState = selfTicketEditState(before, userId);
    if (!editState.is_requester) {
      return res.status(403).json({ success: false, error: { code: 'NOT_REQUESTER', message: 'Sólo quien creó el ticket puede modificarlo' } });
    }
    if (!editState.editable) {
      return res.status(409).json({ success: false, error: { code: 'EDIT_WINDOW_EXPIRED', message: 'El plazo de 10 minutos para modificar este ticket terminó' } });
    }
    const [result]: any = await pool.query(
      `UPDATE tickets SET title = ?, description = ?
        WHERE id = ? AND requester_id = ? AND deleted_at IS NULL
          AND DATE_ADD(created_at, INTERVAL 10 MINUTE) > CURRENT_TIMESTAMP`,
      [title, description || null, req.params.id, userId]
    );
    if (!result.affectedRows) {
      return res.status(409).json({ success: false, error: { code: 'EDIT_WINDOW_EXPIRED', message: 'El plazo de 10 minutos para modificar este ticket terminó' } });
    }
    await logAudit(userId, req.user?.name || req.user?.full_name || null, 'ticket.self.update', 'ticket', req.params.id, { title: before.title, description: before.description }, { title, description: description || null }, req.ip, req.get('user-agent'));
    const [updatedRows]: any = await pool.query(`${selfTicketSelect} WHERE t.id = ? LIMIT 1`, [req.params.id]);
    return res.json({ success: true, data: serializeSelfTicket(updatedRows[0], userId), message: 'Ticket actualizado correctamente' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error al actualizar el ticket' } });
  }
});

router.get('/team-notifications', requireCoreAuth, async (req, res) => {
  const userId = String(req.user?.id || '');
  if (!userId) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Token missing' } });
  }
  try {
    res.json({ success: true, data: await listTeamTicketNotifications(userId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error al consultar las novedades de tus equipos' } });
  }
});

router.post('/', requireCoreAuth, async (req, res) => {
  const userId = String(req.user?.id || '');
  const title = String(req.body?.title || '').trim();
  const description = String(req.body?.description || '').trim();
  const areaId = Number(req.body?.business_area_id) || 0;
  const categoryId = Number(req.body?.category_id) || null;
  const subcategoryId = Number(req.body?.subcategory_id) || null;
  const priorityCode = String(req.body?.priority_code || 'P3').trim().toUpperCase();
  if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Token missing' } });
  if (!title || title.length > 255) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'El título debe tener entre 1 y 255 caracteres' } });
  }
  if (description.length > 10000) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'La descripción no puede exceder 10,000 caracteres' } });
  }
  if (!areaId || !categoryId) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Selecciona el área y la categoría del ticket' } });
  }
  try {
    const classification = await validateTicketClassification(areaId, categoryId, subcategoryId);
    if (!classification.valid) {
      return res.status(400).json({ success: false, error: { code: classification.code, message: classification.message } });
    }
    const [priorities]: any = await pool.query('SELECT code FROM ticket_priorities WHERE code = ? LIMIT 1', [priorityCode]);
    if (!priorities.length) return res.status(400).json({ success: false, error: { code: 'INVALID_PRIORITY', message: 'La prioridad seleccionada no está disponible' } });

    const context = await getTicketContext(bearerToken(req));
    const primaryDevice = context?.primary_device || null;
    const location = context?.location || null;
    const ticket = await withTicketCreationPermission(userId, () => createTicket({
      title,
      description: description || null,
      business_area_id: areaId,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      categories: [{ category_id: categoryId, subcategory_id: subcategoryId }],
      priority_code: priorityCode,
      requester_id: userId,
      requester_name: req.user?.name || req.user?.full_name || null,
      requester_email: req.user?.email || null,
      requester_number: Number(context?.requester_number || req.user?.user_number) || null,
      requester_device_id: primaryDevice?.id || null,
      requester_device_internal_id: primaryDevice?.internal_id || null,
      requester_device_name: primaryDevice?.name || null,
      origin_site_id: location?.site_id || null,
      origin_site_name: location?.site_name || null,
      origin_building_name: location?.building_name || null,
      origin_floor_name: location?.floor_name || null,
      origin_area_id: location?.area_id || null,
      origin_area_name: location?.area_name || null,
      created_by: userId,
    }));
    await logAudit(userId, req.user?.name || req.user?.full_name || null, 'ticket.self.create', 'ticket', ticket.id, null, ticket);
    res.status(201).json({ success: true, data: ticket, message: 'Ticket enviado correctamente' });
  } catch (err) {
    console.error(err);
    if (sendTicketCreationLimitError(res, err)) return;
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error al crear el ticket' } });
  }
});

export default router;
