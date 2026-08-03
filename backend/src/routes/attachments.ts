import { Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import { requireAuth } from '../middlewares/auth';
import { saveAttachment } from '../services/storage';
import pool from '../config/db';
import { logAudit } from '../services/audit';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router({ mergeParams: true });

const allowed = (process.env.ATTACHMENTS_ALLOW || 'image/jpeg,image/png,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip').split(',');

router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, filename, mime_type, size_bytes, created_at FROM ticket_attachments WHERE ticket_id = ? ORDER BY created_at DESC',
      [Number(req.params.id)]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error al consultar archivos' } });
  }
});

router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  const ticketId = Number(req.params.id);
  if (!req.file) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'File required' } });
  if (!allowed.includes(req.file.mimetype)) return res.status(400).json({ success: false, error: { code: 'INVALID_FILE', message: 'Tipo de archivo no permitido' } });

  try {
    const saved = await saveAttachment(req.file.originalname, req.file.buffer, req.file.mimetype);
    const uploaderId = req.user?.id || null;
    const [result]: any = await pool.query('INSERT INTO ticket_attachments (ticket_id, uploaded_by, filename, storage_path, mime_type, size_bytes) VALUES (?,?,?,?,?,?)', [ticketId, uploaderId, saved.filename, saved.storage_path, saved.mime_type, saved.size]);
    await logAudit(uploaderId, req.user?.name || null, 'attachment.upload', 'ticket_attachment', result.insertId, null, { ticket_id: ticketId, filename: saved.filename });
    const [rows]: any = await pool.query('SELECT id, filename, mime_type, size_bytes, created_at FROM ticket_attachments WHERE id = ? LIMIT 1', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'STORAGE_ERROR', message: 'Error saving attachment' } });
  }
});

// Download attachment
router.get('/:attachmentId', requireAuth, async (req, res) => {
  const attachmentId = Number(req.params.attachmentId);
  try {
    const [rows]: any = await pool.query('SELECT filename, storage_path, mime_type FROM ticket_attachments WHERE id = ? LIMIT 1', [attachmentId]);
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Attachment not found' } });
    const att = rows[0];
    // Send file
    return res.sendFile(att.storage_path, { headers: { 'Content-Type': att.mime_type, 'Content-Disposition': `attachment; filename="${att.filename}"` } }, (err) => {
      if (err) {
        // eslint-disable-next-line no-console
        console.error('sendFile error', err);
        res.status(500).end();
      }
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error fetching attachment' } });
  }
});

// Delete attachment (only uploader or admin)
router.delete('/:attachmentId', requireAuth, async (req, res) => {
  const attachmentId = Number(req.params.attachmentId);
  const userId = req.user?.id || null;
  const roles: string[] = req.user?.roles || [];
  try {
    const [rows]: any = await pool.query('SELECT uploaded_by, storage_path FROM ticket_attachments WHERE id = ? LIMIT 1', [attachmentId]);
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Attachment not found' } });
    const att = rows[0];
    if (!(roles.includes('Administrador') || att.uploaded_by === userId)) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not allowed to delete' } });
    // delete file and db record
    try {
      await fs.promises.unlink(att.storage_path);
    } catch (err) {
      // ignore file delete errors
      // eslint-disable-next-line no-console
      console.warn('file unlink warning', err);
    }
    await pool.query('DELETE FROM ticket_attachments WHERE id = ?', [attachmentId]);
    res.json({ success: true, message: 'Attachment deleted' });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error deleting attachment' } });
  }
});

export default router;
