import { Router } from 'express';
import pool from '../config/db';
import { requireAuth, requirePermission } from '../middlewares/auth';
import { logAudit } from '../services/audit';
import { canAccessTicket, getTicketAreaScope, requireTicketAreaAccess } from '../services/ticketAreaAccess';

const router = Router();
const RELATION_TYPES = new Set(['related', 'duplicate', 'blocks', 'blocked_by', 'problem', 'change']);
const SYMMETRIC_RELATIONS = new Set(['related', 'duplicate']);
const TAG_COLORS = new Set(['stone', 'blue', 'green', 'amber', 'red', 'purple']);

function actor(req: any) {
  return {
    id: String(req.user?.id || '') || null,
    name: req.user?.name || req.user?.full_name || null,
  };
}

export function parseTicketIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 100);
}

export function normalizeRelation(sourceId: number, relatedId: number, relationType: string) {
  if (SYMMETRIC_RELATIONS.has(relationType) && relatedId < sourceId) return { sourceId: relatedId, relatedId: sourceId };
  return { sourceId, relatedId };
}

async function requireAllTicketAccess(user: any, ids: number[]) {
  for (const id of ids) {
    const access = await canAccessTicket(user, id);
    if (access !== 'allowed') return { ok: false as const, id, access };
  }
  return { ok: true as const };
}

async function validateAreaMember(connection: any, ticketId: number, userId: string) {
  const [[area]]: any = await connection.query(
    `SELECT COALESCE(t.business_area_id, c.business_area_id) AS business_area_id
       FROM tickets t LEFT JOIN ticket_categories c ON c.id = t.category_id
      WHERE t.id = ? AND t.deleted_at IS NULL LIMIT 1`,
    [ticketId]
  );
  if (!area?.business_area_id) return false;
  const [members]: any = await connection.query(
    'SELECT 1 FROM business_area_members WHERE business_area_id = ? AND user_id = ? LIMIT 1',
    [area.business_area_id, userId]
  );
  return members.length > 0;
}

router.get('/search', requireAuth, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ success: true, data: { tickets: [], people: [], assets: [], articles: [] } });
  const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
  const scope = await getTicketAreaScope(req.user);
  try {
    const [tickets, people, assets, articles] = await Promise.all([
      pool.query(
        `SELECT t.id, t.folio, t.title, t.priority_code, s.name AS status_name, t.updated_at
           FROM tickets t JOIN ticket_statuses s ON s.id = t.status_id
           LEFT JOIN ticket_categories c ON c.id = t.category_id
          WHERE t.deleted_at IS NULL AND ${scope.sql}
            AND CONCAT_WS(' ', t.folio, t.title, t.description, t.requester_name) LIKE ? ESCAPE '\\\\'
          ORDER BY t.updated_at DESC LIMIT 8`,
        [...scope.params, like]
      ),
      pool.query(
        `SELECT t.requester_id AS id, MAX(t.requester_name) AS name, MAX(t.requester_email) AS email, COUNT(*) AS ticket_count
           FROM tickets t LEFT JOIN ticket_categories c ON c.id = t.category_id
          WHERE t.deleted_at IS NULL AND ${scope.sql} AND t.requester_id IS NOT NULL
            AND CONCAT_WS(' ', t.requester_name, t.requester_email) LIKE ? ESCAPE '\\\\'
          GROUP BY t.requester_id ORDER BY MAX(t.updated_at) DESC LIMIT 6`,
        [...scope.params, like]
      ),
      pool.query(
        `SELECT COALESCE(t.asset_uid, t.related_device_id) AS id,
                MAX(COALESCE(t.asset_number, t.affected_device_internal_id)) AS code,
                MAX(t.affected_device_name) AS name, COUNT(*) AS ticket_count
           FROM tickets t LEFT JOIN ticket_categories c ON c.id = t.category_id
          WHERE t.deleted_at IS NULL AND ${scope.sql}
            AND COALESCE(t.asset_uid, t.related_device_id) IS NOT NULL
            AND CONCAT_WS(' ', t.asset_uid, t.asset_number, t.affected_device_internal_id, t.affected_device_name) LIKE ? ESCAPE '\\\\'
          GROUP BY COALESCE(t.asset_uid, t.related_device_id) ORDER BY MAX(t.updated_at) DESC LIMIT 6`,
        [...scope.params, like]
      ),
      pool.query(
        `SELECT id, title, LEFT(body, 180) AS snippet, updated_at
           FROM kb_articles
          WHERE status = 'published' AND CONCAT_WS(' ', title, body) LIKE ? ESCAPE '\\\\'
          ORDER BY updated_at DESC LIMIT 6`,
        [like]
      ),
    ]);
    res.json({ success: true, data: { tickets: tickets[0], people: people[0], assets: assets[0], articles: articles[0] } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'No se pudo ejecutar la búsqueda operativa' } });
  }
});

router.get('/tags', requireAuth, async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, color FROM ticket_tags WHERE active = 1 ORDER BY name');
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'No se pudieron consultar las etiquetas' } });
  }
});

router.post('/tags', requireAuth, requirePermission('Administrar categorías'), async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const color = TAG_COLORS.has(String(req.body?.color || '')) ? String(req.body.color) : 'stone';
  if (name.length < 2 || name.length > 50) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_TAG', message: 'El nombre debe tener entre 2 y 50 caracteres' } });
  }
  try {
    const who = actor(req);
    await pool.query(
      `INSERT INTO ticket_tags (name, color, active, created_by) VALUES (?, ?, 1, ?)
       ON DUPLICATE KEY UPDATE color = VALUES(color), active = 1`,
      [name, color, who.id]
    );
    const [[tag]]: any = await pool.query('SELECT id, name, color FROM ticket_tags WHERE name = ? LIMIT 1', [name]);
    await logAudit(who.id, who.name, 'ticket_tag.save', 'ticket_tag', tag.id, null, tag);
    res.status(201).json({ success: true, data: tag });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'No se pudo guardar la etiqueta' } });
  }
});

router.get('/items/:id/context', requireAuth, requireTicketAreaAccess, async (req, res) => {
  const id = Number(req.params.id);
  const scope = await getTicketAreaScope(req.user, 'other', 'oc');
  try {
    const [[ticket]]: any = await pool.query(
      'SELECT escalated_at, escalated_by, escalation_reason FROM tickets WHERE id = ? LIMIT 1',
      [id]
    );
    const [tags]: any = await pool.query(
      `SELECT tt.id, tt.name, tt.color FROM ticket_tag_links ttl
       JOIN ticket_tags tt ON tt.id = ttl.tag_id WHERE ttl.ticket_id = ? AND tt.active = 1 ORDER BY tt.name`,
      [id]
    );
    const [relations]: any = await pool.query(
      `SELECT r.id, r.relation_type, other.id AS ticket_id, other.folio, other.title,
              os.name AS status_name, other.priority_code
         FROM ticket_relations r
         JOIN tickets other ON other.id = CASE WHEN r.ticket_id = ? THEN r.related_ticket_id ELSE r.ticket_id END
         JOIN ticket_statuses os ON os.id = other.status_id
         LEFT JOIN ticket_categories oc ON oc.id = other.category_id
        WHERE (r.ticket_id = ? OR r.related_ticket_id = ?) AND other.deleted_at IS NULL AND ${scope.sql}
        ORDER BY r.created_at DESC`,
      [id, id, id, ...scope.params]
    );
    const [[source]]: any = await pool.query('SELECT title, category_id FROM tickets WHERE id = ? LIMIT 1', [id]);
    const terms = String(source?.title || '').split(/\s+/).map((term) => term.replace(/[^\p{L}\p{N}-]/gu, '')).filter((term) => term.length >= 4).slice(0, 4);
    const similarClauses = ['other.id <> ?', 'other.deleted_at IS NULL', scope.sql];
    const similarParams: Array<string | number> = [id, ...scope.params];
    if (source?.category_id || terms.length) {
      const matches: string[] = [];
      if (source?.category_id) { matches.push('other.category_id = ?'); similarParams.push(source.category_id); }
      for (const term of terms) { matches.push('other.title LIKE ?'); similarParams.push(`%${term}%`); }
      similarClauses.push(`(${matches.join(' OR ')})`);
    } else {
      similarClauses.push('1 = 0');
    }
    const [similar]: any = await pool.query(
      `SELECT other.id, other.folio, other.title, other.priority_code, os.name AS status_name,
              (other.category_id <=> ?) AS same_category
         FROM tickets other JOIN ticket_statuses os ON os.id = other.status_id
         LEFT JOIN ticket_categories oc ON oc.id = other.category_id
        WHERE ${similarClauses.join(' AND ')}
        ORDER BY same_category DESC, other.updated_at DESC LIMIT 5`,
      [source?.category_id || null, ...similarParams]
    );
    res.json({ success: true, data: { escalation: ticket, tags, relations, similar } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'No se pudo consultar el contexto relacionado' } });
  }
});

router.post('/items/:id/escalate', requireAuth, requireTicketAreaAccess, requirePermission('Asignar tickets'), async (req, res) => {
  const reason = String(req.body?.reason || '').trim();
  if (reason.length < 3 || reason.length > 500) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_REASON', message: 'Escribe un motivo de 3 a 500 caracteres' } });
  }
  try {
    const who = actor(req);
    const [[before]]: any = await pool.query('SELECT escalated_at, escalated_by, escalation_reason FROM tickets WHERE id = ? LIMIT 1', [req.params.id]);
    await pool.query('UPDATE tickets SET escalated_at = NOW(), escalated_by = ?, escalation_reason = ? WHERE id = ?', [who.id, reason, req.params.id]);
    await logAudit(who.id, who.name, 'ticket.escalate', 'ticket', req.params.id, before, { escalated: true, reason });
    res.json({ success: true, data: { escalated: true, reason }, message: 'Ticket escalado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'No se pudo escalar el ticket' } });
  }
});

router.post('/items/:id/deescalate', requireAuth, requireTicketAreaAccess, requirePermission('Asignar tickets'), async (req, res) => {
  try {
    const who = actor(req);
    const [[before]]: any = await pool.query('SELECT escalated_at, escalated_by, escalation_reason FROM tickets WHERE id = ? LIMIT 1', [req.params.id]);
    await pool.query('UPDATE tickets SET escalated_at = NULL, escalated_by = NULL, escalation_reason = NULL WHERE id = ?', [req.params.id]);
    await logAudit(who.id, who.name, 'ticket.deescalate', 'ticket', req.params.id, before, { escalated: false });
    res.json({ success: true, data: { escalated: false }, message: 'Escalamiento retirado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'No se pudo retirar el escalamiento' } });
  }
});

router.post('/items/:id/tags', requireAuth, requireTicketAreaAccess, async (req, res) => {
  const tagId = Number(req.body?.tag_id);
  if (!Number.isInteger(tagId) || tagId < 1) return res.status(400).json({ success: false, error: { code: 'INVALID_TAG', message: 'Etiqueta inválida' } });
  try {
    const who = actor(req);
    const [[tag]]: any = await pool.query('SELECT id, name, color FROM ticket_tags WHERE id = ? AND active = 1 LIMIT 1', [tagId]);
    if (!tag) return res.status(404).json({ success: false, error: { code: 'TAG_NOT_FOUND', message: 'Etiqueta no encontrada' } });
    await pool.query('INSERT IGNORE INTO ticket_tag_links (ticket_id, tag_id, created_by) VALUES (?, ?, ?)', [req.params.id, tagId, who.id]);
    await logAudit(who.id, who.name, 'ticket.tag.add', 'ticket', req.params.id, null, tag);
    res.status(201).json({ success: true, data: tag });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'No se pudo agregar la etiqueta' } });
  }
});

router.post('/items/:id/tags/:tagId/remove', requireAuth, requireTicketAreaAccess, async (req, res) => {
  try {
    const who = actor(req);
    await pool.query('DELETE FROM ticket_tag_links WHERE ticket_id = ? AND tag_id = ?', [req.params.id, req.params.tagId]);
    await logAudit(who.id, who.name, 'ticket.tag.remove', 'ticket', req.params.id, { tag_id: req.params.tagId }, null);
    res.status(204).end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'No se pudo quitar la etiqueta' } });
  }
});

router.post('/items/:id/relations', requireAuth, requireTicketAreaAccess, async (req, res) => {
  let sourceId = Number(req.params.id);
  let relatedId = Number(req.body?.related_ticket_id);
  const relationType = RELATION_TYPES.has(String(req.body?.relation_type || '')) ? String(req.body.relation_type) : 'related';
  if (!Number.isInteger(relatedId) || relatedId < 1 || sourceId === relatedId) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_RELATION', message: 'Selecciona otro ticket válido' } });
  }
  const access = await canAccessTicket(req.user, relatedId);
  if (access !== 'allowed') return res.status(access === 'missing' ? 404 : 403).json({ success: false, error: { code: 'RELATED_TICKET_FORBIDDEN', message: 'No puedes relacionar ese ticket' } });
  ({ sourceId, relatedId } = normalizeRelation(sourceId, relatedId, relationType));
  try {
    const who = actor(req);
    await pool.query(
      'INSERT IGNORE INTO ticket_relations (ticket_id, related_ticket_id, relation_type, created_by) VALUES (?, ?, ?, ?)',
      [sourceId, relatedId, relationType, who.id]
    );
    await logAudit(who.id, who.name, 'ticket.relation.add', 'ticket', req.params.id, null, { related_ticket_id: req.body.related_ticket_id, relation_type: relationType });
    res.status(201).json({ success: true, message: 'Ticket relacionado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'No se pudo relacionar el ticket' } });
  }
});

router.post('/items/:id/relations/:relationId/remove', requireAuth, requireTicketAreaAccess, async (req, res) => {
  try {
    const who = actor(req);
    await pool.query('DELETE FROM ticket_relations WHERE id = ? AND (ticket_id = ? OR related_ticket_id = ?)', [req.params.relationId, req.params.id, req.params.id]);
    await logAudit(who.id, who.name, 'ticket.relation.remove', 'ticket', req.params.id, { relation_id: req.params.relationId }, null);
    res.status(204).end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'No se pudo quitar la relación' } });
  }
});

router.post('/bulk/escalate', requireAuth, requirePermission('Asignar tickets'), async (req, res) => {
  const ids = parseTicketIds(req.body?.ticket_ids);
  const reason = String(req.body?.reason || '').trim();
  if (!ids.length) return res.status(400).json({ success: false, error: { code: 'NO_TICKETS', message: 'Selecciona al menos un ticket' } });
  if (reason.length < 3 || reason.length > 500) return res.status(400).json({ success: false, error: { code: 'INVALID_REASON', message: 'Escribe un motivo de 3 a 500 caracteres' } });
  const access = await requireAllTicketAccess(req.user, ids);
  if (!access.ok) return res.status(access.access === 'missing' ? 404 : 403).json({ success: false, error: { code: 'BULK_FORBIDDEN', message: `No puedes modificar el ticket ${access.id}` } });
  try {
    const who = actor(req);
    await pool.query(`UPDATE tickets SET escalated_at = NOW(), escalated_by = ?, escalation_reason = ? WHERE id IN (${ids.map(() => '?').join(',')})`, [who.id, reason, ...ids]);
    await logAudit(who.id, who.name, 'ticket.bulk.escalate', 'ticket_bulk', ids.join(','), null, { ticket_ids: ids, reason });
    res.json({ success: true, data: { updated: ids.length }, message: `${ids.length} tickets escalados` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'No se pudieron escalar los tickets' } });
  }
});

router.post('/bulk/assign', requireAuth, requirePermission('Asignar tickets'), async (req, res) => {
  const ids = parseTicketIds(req.body?.ticket_ids);
  const requestedAssignee = String(req.body?.assigned_to || '').trim();
  const assignedTo = requestedAssignee === 'me' ? String(req.user?.id || '') : requestedAssignee;
  const assignedToName = requestedAssignee === 'me'
    ? (req.user?.name || req.user?.full_name || null)
    : (String(req.body?.assigned_to_name || '').trim() || null);
  if (!ids.length || !assignedTo) return res.status(400).json({ success: false, error: { code: 'INVALID_ASSIGNMENT', message: 'Selecciona tickets y responsable' } });
  const access = await requireAllTicketAccess(req.user, ids);
  if (!access.ok) return res.status(access.access === 'missing' ? 404 : 403).json({ success: false, error: { code: 'BULK_FORBIDDEN', message: `No puedes modificar el ticket ${access.id}` } });
  const connection = await pool.getConnection();
  try {
    for (const id of ids) {
      if (!(await validateAreaMember(connection, id, assignedTo))) {
        return res.status(400).json({ success: false, error: { code: 'NOT_AREA_MEMBER', message: `El responsable no pertenece al área del ticket ${id}` } });
      }
    }
    const who = actor(req);
    await connection.beginTransaction();
    for (const id of ids) {
      await connection.query('INSERT INTO ticket_assignments (ticket_id, assigned_to, assigned_to_name, assigned_by, note) VALUES (?, ?, ?, ?, ?)', [id, assignedTo, assignedToName, who.id, 'Asignación masiva desde la bandeja operativa']);
      await connection.query('UPDATE tickets SET assigned_to = ?, assigned_to_name = ? WHERE id = ?', [assignedTo, assignedToName, id]);
    }
    await connection.commit();
    await logAudit(who.id, who.name, 'ticket.bulk.assign', 'ticket_bulk', ids.join(','), null, { ticket_ids: ids, assigned_to: assignedTo, assigned_to_name: assignedToName });
    res.json({ success: true, data: { updated: ids.length }, message: `${ids.length} tickets asignados` });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'No se pudieron asignar los tickets' } });
  } finally {
    connection.release();
  }
});

export default router;
