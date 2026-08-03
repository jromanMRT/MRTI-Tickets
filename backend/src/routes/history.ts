import { Router } from 'express';
import pool from '../config/db';
import { requireAuth } from '../middlewares/auth';

const router = Router({ mergeParams: true });

router.get('/', requireAuth, async (req, res) => {
  const ticketId = Number(req.params.id);
  try {
    const [statusRows]: any = await pool.query(
      `SELECT h.from_status_id, fs.name AS from_status_name, h.to_status_id,
              ts.name AS to_status_name, h.changed_by, h.comment, h.created_at
         FROM ticket_status_history h
         LEFT JOIN ticket_statuses fs ON fs.id = h.from_status_id
         JOIN ticket_statuses ts ON ts.id = h.to_status_id
        WHERE h.ticket_id = ? ORDER BY h.created_at`, [ticketId]);
    const [assignRows]: any = await pool.query('SELECT assigned_to, assigned_to_name, assigned_by, note, created_at FROM ticket_assignments WHERE ticket_id = ? ORDER BY created_at', [ticketId]);
    const [slaRows]: any = await pool.query('SELECT event_type, event_at, meta FROM ticket_sla_events WHERE ticket_id = ? ORDER BY event_at', [ticketId]);
    res.json({ success: true, data: { status_history: statusRows, assignments: assignRows, sla_events: slaRows } });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error fetching history' } });
  }
});

export default router;
