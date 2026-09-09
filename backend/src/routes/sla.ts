import { Router } from 'express';
import pool from '../config/db';
import { requireAuth, requirePermission } from '../middlewares/auth';
import { getSlaStatusForTicket } from '../services/slaService';
import { requireTicketAreaAccess } from '../services/ticketAreaAccess';

const router = Router();

const POLICY_SELECT = `
  SELECT sp.id, sp.name, sp.priority_code, sp.first_response_minutes, sp.resolution_minutes, sp.include_holidays,
         sp.business_area_id, b.name AS business_area_name, sp.category_id, c.name AS category_name
    FROM sla_policies sp
    LEFT JOIN business_areas b ON b.id = sp.business_area_id
    LEFT JOIN ticket_categories c ON c.id = sp.category_id`;

// List SLA policies -- una fila con área/categoría en null aplica a
// cualquier ticket con esa prioridad que no calce con una más específica
// (ver services/slaSql.ts: SLA_POLICY_RESOLUTION_SQL).
router.get('/sla/policies', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(`${POLICY_SELECT} ORDER BY sp.priority_code, sp.business_area_id IS NULL, sp.category_id IS NULL`);
    res.json({ success: true, data: rows });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error listing SLA policies' } });
  }
});

// Create SLA policy. business_area_id/category_id son opcionales: sin
// ellos, la política es la genérica de esa prioridad (comportamiento
// anterior a la migración 011). Enviar category_id sin business_area_id
// se rechaza -- una categoría siempre pertenece a un área (ver
// ticket_categories.business_area_id), así que una regla "esta categoría
// en cualquier área" no tiene sentido en este esquema.
router.post('/sla/policies', requireAuth, requirePermission('Administrar SLA'), async (req, res) => {
  const { name, priority_code, first_response_minutes, resolution_minutes, include_holidays, business_area_id, category_id } = req.body;
  if (!name || !priority_code || typeof resolution_minutes !== 'number') return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'name, priority_code and resolution_minutes are required' } });
  if (category_id && !business_area_id) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'category_id requiere business_area_id' } });
  try {
    const [result]: any = await pool.query(
      'INSERT INTO sla_policies (name, priority_code, first_response_minutes, resolution_minutes, include_holidays, business_area_id, category_id) VALUES (?,?,?,?,?,?,?)',
      [name, priority_code, first_response_minutes || 0, resolution_minutes, include_holidays === false ? 0 : 1, business_area_id || null, category_id || null]
    );
    const [rows] = await pool.query(`${POLICY_SELECT} WHERE sp.id = ? LIMIT 1`, [result.insertId]);
    res.status(201).json({ success: true, data: (rows as any[])[0] });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, error: { code: 'DUPLICATE_POLICY', message: 'Ya existe una política para esa combinación de prioridad, área y categoría' } });
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message || 'Error creating SLA' } });
  }
});

router.patch('/sla/policies/:id', requireAuth, requirePermission('Administrar SLA'), async (req, res) => {
  const { name, first_response_minutes, resolution_minutes, include_holidays } = req.body;
  try {
    const [[existing]]: any = await pool.query('SELECT * FROM sla_policies WHERE id = ? LIMIT 1', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Política no encontrada' } });
    await pool.query(
      'UPDATE sla_policies SET name = ?, first_response_minutes = ?, resolution_minutes = ?, include_holidays = ? WHERE id = ?',
      [
        name !== undefined ? name : existing.name,
        first_response_minutes !== undefined ? first_response_minutes : existing.first_response_minutes,
        resolution_minutes !== undefined ? resolution_minutes : existing.resolution_minutes,
        include_holidays !== undefined ? (include_holidays ? 1 : 0) : existing.include_holidays,
        req.params.id,
      ]
    );
    const [rows] = await pool.query(`${POLICY_SELECT} WHERE sp.id = ? LIMIT 1`, [req.params.id]);
    res.json({ success: true, data: (rows as any[])[0] });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error updating SLA policy' } });
  }
});

// No se permite borrar la última política genérica de una prioridad
// (business_area_id y category_id ambos null): sin ella, un ticket de esa
// prioridad sin una regla más específica se queda sin SLA -- eso debe ser
// una decisión explícita (editarla), no un borrado accidental.
router.delete('/sla/policies/:id', requireAuth, requirePermission('Administrar SLA'), async (req, res) => {
  try {
    const [[existing]]: any = await pool.query('SELECT * FROM sla_policies WHERE id = ? LIMIT 1', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Política no encontrada' } });
    if (!existing.business_area_id && !existing.category_id) {
      return res.status(409).json({ success: false, error: { code: 'GENERIC_POLICY', message: 'No se puede eliminar la política genérica de una prioridad; edítala en vez de borrarla' } });
    }
    await pool.query('DELETE FROM sla_policies WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error deleting SLA policy' } });
  }
});

// Get SLA status for a ticket
router.get('/tickets/:id/sla-status', requireAuth, requireTicketAreaAccess, async (req, res) => {
  const ticketId = Number(req.params.id);
  try {
    const status = await getSlaStatusForTicket(ticketId);
    res.json({ success: true, data: status });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'SLA_ERROR', message: 'Error computing SLA status' } });
  }
});

export default router;
