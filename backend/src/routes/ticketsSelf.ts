import { Router } from 'express';
import pool from '../config/db';
import { requireAuth } from '../middlewares/auth';

const router = Router();

// Autoservicio (Fase 7 de CORE_INFRA_MIGRATION_GUIDE.md): tickets propios
// (creados o asignados), para el dashboard personal de Core — no requiere
// abrir el módulo administrativo de Tickets.
router.get('/me', requireAuth, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Token missing' } });
  }
  try {
    const [rows]: any = await pool.query(
      `SELECT t.id, t.folio, t.title, t.priority_code, t.assigned_to, t.assigned_to_name,
              t.requester_id, t.requester_name, t.created_at, t.updated_at,
              s.code AS status_code, s.name AS status_name,
              p.name AS priority_name
         FROM tickets t
         JOIN ticket_statuses s ON s.id = t.status_id
         LEFT JOIN ticket_priorities p ON p.code = t.priority_code
        WHERE t.deleted_at IS NULL AND (t.requester_id = ? OR t.assigned_to = ?)
        ORDER BY t.created_at DESC LIMIT 20`,
      [userId, userId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error al consultar tus tickets' } });
  }
});

export default router;
