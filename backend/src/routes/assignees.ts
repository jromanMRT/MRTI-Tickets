import { Router } from 'express';
import axios from 'axios';
import pool from '../config/db';
import { requireAuth } from '../middlewares/auth';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const roles = (req.user?.roles || []).map((role: string) => role.toLowerCase());
  if (!roles.some((role: string) => ['administrador', 'administrator', 'supervisor', 'técnico', 'technician'].includes(role))) {
    return res.json({ success: true, data: [] });
  }
  const url = process.env.AUTH_ASSIGNEES_URL;
  if (!url) return res.json({ success: true, data: [] });
  try {
    const response = await axios.get(url, { headers: { Authorization: req.headers.authorization } });
    let assignees = response.data?.data || [];

    const businessAreaId = req.query.business_area_id;
    if (businessAreaId) {
      const [members]: any = await pool.query(
        'SELECT user_id FROM business_area_members WHERE business_area_id = ?',
        [businessAreaId]
      );
      const memberIds = new Set(members.map((row: any) => row.user_id));
      assignees = assignees.filter((person: any) => memberIds.has(person.id));
    }

    res.json({ success: true, data: assignees });
  } catch (err) {
    console.error('Assignee lookup failed', err);
    res.status(502).json({ success: false, error: { code: 'ASSIGNEES_UNAVAILABLE', message: 'No se pudo consultar el personal de soporte' } });
  }
});

export default router;
