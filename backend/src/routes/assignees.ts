import { Router } from 'express';
import axios from 'axios';
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
    res.json({ success: true, data: response.data?.data || [] });
  } catch (err) {
    console.error('Assignee lookup failed', err);
    res.status(502).json({ success: false, error: { code: 'ASSIGNEES_UNAVAILABLE', message: 'No se pudo consultar el personal de soporte' } });
  }
});

export default router;
