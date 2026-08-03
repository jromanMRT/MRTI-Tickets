import { Router } from 'express';
import pool from '../config/db';
import { requireAuth } from '../middlewares/auth';
import { logAudit } from '../services/audit';

const router = Router({ mergeParams: true });

router.get('/', requireAuth, async (req, res) => {
  const ticketId = Number(req.params.id);
  try {
    const [rows] = await pool.query('SELECT id, author_id, author_name, is_private, content, edited_at, created_at FROM ticket_comments WHERE ticket_id = ? ORDER BY created_at', [ticketId]);
    res.json({ success: true, data: rows });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error listing comments' } });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const ticketId = Number(req.params.id);
  const { content, is_private } = req.body;
  if (!content) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Content required' } });

  const authorId = (req.user && req.user.id) || null;
  const authorName = (req.user && (req.user.name || req.user.fullname)) || null;

  // if private, check permission
  if (is_private) {
    const perms: string[] = req.user?.permissions || [];
    const roles: string[] = req.user?.roles || [];
    if (!(roles.includes('Técnico') || roles.includes('Supervisor') || roles.includes('Administrador') || perms.includes('Agregar notas internas'))) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'No autorizado para notas internas' } });
    }
  }

  try {
    const [result]: any = await pool.query('INSERT INTO ticket_comments (ticket_id, author_id, author_name, is_private, content) VALUES (?,?,?,?,?)', [ticketId, authorId, authorName, is_private ? 1 : 0, content]);
    await logAudit(authorId, authorName, 'comment.create', 'ticket_comment', result.insertId, null, { ticket_id: ticketId, is_private: !!is_private, content });
    const [rows]: any = await pool.query('SELECT id, author_id, author_name, is_private, content, edited_at, created_at FROM ticket_comments WHERE id = ? LIMIT 1', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error creating comment' } });
  }
});

export default router;
