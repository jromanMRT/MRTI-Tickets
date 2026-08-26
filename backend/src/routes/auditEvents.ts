import { Router } from 'express';
import pool from '../config/db';
import { requireAuth } from '../middlewares/auth';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const roles = [...(req.user?.roles || []), req.user?.role || ''].map((role: string) => role.toLowerCase());
    if (!roles.some((role: string) => ['administrator', 'administrador'].includes(role))) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Sólo administradores pueden consultar auditoría' } });
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const [rows] = await pool.query<any[]>(
      `SELECT id,actor_id,actor_name,action,entity,entity_id,before_json,after_json,ip_address,user_agent,created_at
         FROM audit_logs ORDER BY id DESC LIMIT ?`, [limit]
    );
    res.json({ data: rows.map((row) => ({
      event_uuid: `tickets-${row.id}`,
      module_code: 'tickets',
      actor_user_id: row.actor_id,
      actor_name: row.actor_name,
      actor_email: null,
      action: row.action,
      entity_type: row.entity,
      entity_id: row.entity_id,
      request_id: null,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      before_json: row.before_json,
      after_json: row.after_json,
      metadata_json: null,
      status_code: 200,
      created_at: row.created_at,
    })) });
  } catch (error) { next(error); }
});

export default router;
