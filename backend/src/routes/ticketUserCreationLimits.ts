import { Router } from 'express';
import pool from '../config/db';
import { requireCoreAuth } from '../middlewares/auth';
import { isGlobalTicketAdministrator } from '../services/ticketAreaAccess';

const router = Router();

router.use(requireCoreAuth, (req, res, next) => {
  if (!isGlobalTicketAdministrator(req.user)) {
    return res.status(403).json({ success: false, error: { code: 'ADMIN_ONLY', message: 'Sólo un administrador puede configurar límites de tickets' } });
  }
  return next();
});

function parseLimit(value: unknown, maximum: number, label: string): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${label} debe ser un número entre 1 y ${maximum}, o quedar vacío`);
  }
  return parsed;
}

router.get('/', async (_req, res) => {
  try {
    const [rows]: any = await pool.query(
      'SELECT user_id, hourly_limit, daily_limit, creation_blocked, updated_by, updated_at FROM ticket_user_creation_limits ORDER BY updated_at DESC'
    );
    res.json({ success: true, data: rows.map((row: any) => ({ ...row, creation_blocked: Boolean(row.creation_blocked) })) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'No fue posible consultar los límites de tickets' } });
  }
});

router.put('/:userId', async (req, res) => {
  const userId = String(req.params.userId || '').trim();
  if (!userId || userId.length > 64) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_USER', message: 'Usuario inválido' } });
  }
  try {
    const hourlyLimit = parseLimit(req.body?.hourly_limit, 100, 'El límite por hora');
    const dailyLimit = parseLimit(req.body?.daily_limit, 1000, 'El límite por 24 horas');
    const blocked = req.body?.creation_blocked === true;
    await pool.query(
      `INSERT INTO ticket_user_creation_limits (user_id, hourly_limit, daily_limit, creation_blocked, updated_by)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE hourly_limit = VALUES(hourly_limit), daily_limit = VALUES(daily_limit),
         creation_blocked = VALUES(creation_blocked), updated_by = VALUES(updated_by)`,
      [userId, hourlyLimit, dailyLimit, blocked, req.user?.id || null]
    );
    res.json({ success: true, data: { user_id: userId, hourly_limit: hourlyLimit, daily_limit: dailyLimit, creation_blocked: blocked } });
  } catch (error: any) {
    if (error?.message?.includes('límite')) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_LIMIT', message: error.message } });
    }
    console.error(error);
    return res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'No fue posible guardar el límite de tickets' } });
  }
});

router.delete('/:userId', async (req, res) => {
  try {
    await pool.query('DELETE FROM ticket_user_creation_limits WHERE user_id = ?', [String(req.params.userId)]);
    res.json({ success: true, data: { user_id: String(req.params.userId) } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'No fue posible restablecer el límite de tickets' } });
  }
});

export default router;
