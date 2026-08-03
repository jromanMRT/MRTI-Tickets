import { Router } from 'express';
import pool from '../config/db';
import { requireAuth, requirePermission } from '../middlewares/auth';
import { getSlaStatusForTicket } from '../services/slaService';

const router = Router();

// List SLA policies
router.get('/sla/policies', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, priority_code, first_response_minutes, resolution_minutes, include_holidays FROM sla_policies ORDER BY priority_code');
    res.json({ success: true, data: rows });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error listing SLA policies' } });
  }
});

// Create SLA policy
router.post('/sla/policies', requireAuth, requirePermission('Administrar SLA'), async (req, res) => {
  const { name, priority_code, first_response_minutes, resolution_minutes, include_holidays } = req.body;
  if (!name || !priority_code || typeof resolution_minutes !== 'number') return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'name, priority_code and resolution_minutes are required' } });
  try {
    const [result]: any = await pool.query('INSERT INTO sla_policies (name, priority_code, first_response_minutes, resolution_minutes, include_holidays) VALUES (?,?,?,?,?)', [name, priority_code, first_response_minutes || 0, resolution_minutes, include_holidays === false ? 0 : 1]);
    const [rows]: any = await pool.query('SELECT id, name, priority_code, first_response_minutes, resolution_minutes, include_holidays FROM sla_policies WHERE id = ? LIMIT 1', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message || 'Error creating SLA' } });
  }
});

// Get SLA status for a ticket
router.get('/tickets/:id/sla-status', requireAuth, async (req, res) => {
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
