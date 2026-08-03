import { Router } from 'express';
import pool from '../config/db';
import { requireAuth, requirePermission } from '../middlewares/auth';
import { logAudit } from '../services/audit';

const router = Router({ mergeParams: true });

router.post('/', requireAuth, requirePermission('Asignar tickets'), async (req, res) => {
  const ticketId = Number(req.params.id);
  const requestedAssignee = req.body.assigned_to;
  const assignedTo = requestedAssignee === 'me' ? req.user?.id : requestedAssignee;
  const assignedToName = requestedAssignee === 'me'
    ? (req.user?.name || req.user?.full_name)
    : req.body.assigned_to_name;
  const { note } = req.body;
  if (!assignedTo) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Selecciona un responsable' } });

  const actorId = req.user?.id || null;
  const actorName = req.user?.name || null;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('INSERT INTO ticket_assignments (ticket_id, assigned_to, assigned_to_name, assigned_by, note) VALUES (?,?,?,?,?)', [ticketId, assignedTo, assignedToName || null, actorId, note || null]);
    await connection.query('UPDATE tickets SET assigned_to = ?, assigned_to_name = ? WHERE id = ?', [assignedTo, assignedToName || null, ticketId]);
    await logAudit(actorId, actorName, 'assignment.create', 'ticket_assignment', null, null, { ticket_id: ticketId, assigned_to: assignedTo, note });
    await connection.commit();
    res.json({ success: true, message: 'Ticket asignado' });
  } catch (err) {
    await connection.rollback();
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error assigning ticket' } });
  } finally {
    connection.release();
  }
});

export default router;
