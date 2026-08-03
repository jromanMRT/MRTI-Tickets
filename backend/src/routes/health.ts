import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({ success: true, data: { status: 'ok', service: 'MRTI-Tickets API' } });
});

export default router;
