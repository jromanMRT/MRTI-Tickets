import { Router } from 'express';
import pool from '../config/db';
import { requireAuth, requirePermission } from '../middlewares/auth';

const router = Router();

const ARTICLE_SELECT = `
  SELECT a.id, a.title, a.body, a.category_id, c.name AS category_name,
         a.subcategory_id, s.name AS subcategory_name, a.status,
         a.created_by, a.created_at, a.updated_at
    FROM kb_articles a
    LEFT JOIN ticket_categories c ON c.id = a.category_id
    LEFT JOIN ticket_subcategories s ON s.id = a.subcategory_id`;

// Sólo puede administrar (crear/editar/archivar) quien tenga el permiso de
// gestión de la KB -- se reevalúa aquí (no sólo en requirePermission) para
// decidir qué filas puede listar/ver: administrador o supervisor ven todo,
// el resto sólo lo publicado.
function canManageKb(req: any): boolean {
  const roles = [...(req.user?.roles || []), req.user?.role || ''].map((role: string) => role.toLowerCase());
  return roles.some((role: string) => ['administrator', 'administrador', 'supervisor'].includes(role));
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const manage = canManageKb(req);
    const clauses = ['1 = 1'];
    const params: Array<string | number> = [];

    if (!manage) {
      clauses.push('a.status = ?');
      params.push('published');
    } else if (req.query.status) {
      clauses.push('a.status = ?');
      params.push(String(req.query.status));
    }
    if (req.query.category_id) {
      clauses.push('a.category_id = ?');
      params.push(String(req.query.category_id));
    }
    if (req.query.subcategory_id) {
      clauses.push('a.subcategory_id = ?');
      params.push(String(req.query.subcategory_id));
    }

    const q = String(req.query.q || '').trim();
    // Una búsqueda vacía en MATCH...AGAINST no significa "traer todo", sino
    // que no devuelve filas -- por eso sólo se agrega la cláusula cuando hay
    // texto real que buscar; sin ?q= se lista en modo "explorar" por fecha.
    let orderBy = 'a.updated_at DESC';
    if (q) {
      clauses.push('MATCH(a.title, a.body) AGAINST (? IN NATURAL LANGUAGE MODE)');
      params.push(q);
      orderBy = 'MATCH(a.title, a.body) AGAINST (? IN NATURAL LANGUAGE MODE) DESC';
      params.push(q);
    }

    const [rows]: any = await pool.query(
      `${ARTICLE_SELECT} WHERE ${clauses.join(' AND ')} ORDER BY ${orderBy}`,
      params
    );
    const data = rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      snippet: String(row.body || '').slice(0, 200),
      category_id: row.category_id,
      category_name: row.category_name,
      subcategory_id: row.subcategory_id,
      subcategory_name: row.subcategory_name,
      status: row.status,
      updated_at: row.updated_at,
    }));
    res.json({ success: true, data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error listing KB articles' } });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const [rows]: any = await pool.query(`${ARTICLE_SELECT} WHERE a.id = ? LIMIT 1`, [req.params.id]);
    const article = rows[0];
    // 404 (no 403) para un borrador que un no-gestor pide directo por id --
    // así no se revela que el artículo existe.
    if (!article || (article.status !== 'published' && !canManageKb(req))) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Artículo no encontrado' } });
    }
    res.json({ success: true, data: article });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error loading KB article' } });
  }
});

router.post('/', requireAuth, requirePermission('Administrar base de conocimiento'), async (req, res) => {
  const { title, body, category_id, subcategory_id, status } = req.body;
  if (!title || !body) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'title y body son requeridos' } });
  }
  try {
    const [result]: any = await pool.query(
      'INSERT INTO kb_articles (title, body, category_id, subcategory_id, status, created_by) VALUES (?,?,?,?,?,?)',
      [title, body, category_id || null, subcategory_id || null, status === 'published' ? 'published' : 'draft', req.user?.id || null]
    );
    const [rows]: any = await pool.query(`${ARTICLE_SELECT} WHERE a.id = ? LIMIT 1`, [result.insertId]);
    res.status(201).json({ success: true, data: rows[0], message: 'Artículo creado' });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message || 'Error creating KB article' } });
  }
});

router.patch('/:id', requireAuth, requirePermission('Administrar base de conocimiento'), async (req, res) => {
  const { title, body, category_id, subcategory_id, status } = req.body;
  try {
    const [[existing]]: any = await pool.query('SELECT * FROM kb_articles WHERE id = ? LIMIT 1', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Artículo no encontrado' } });
    await pool.query(
      'UPDATE kb_articles SET title = ?, body = ?, category_id = ?, subcategory_id = ?, status = ? WHERE id = ?',
      [
        title !== undefined ? title : existing.title,
        body !== undefined ? body : existing.body,
        category_id !== undefined ? (category_id || null) : existing.category_id,
        subcategory_id !== undefined ? (subcategory_id || null) : existing.subcategory_id,
        status !== undefined ? status : existing.status,
        req.params.id,
      ]
    );
    const [rows]: any = await pool.query(`${ARTICLE_SELECT} WHERE a.id = ? LIMIT 1`, [req.params.id]);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error updating KB article' } });
  }
});

// No hace hard-delete: nada referencia kb_articles.id como FK, así que
// borrar sería técnicamente seguro, pero un artículo ya enlazado desde una
// sugerencia vista en un ticket viejo es mejor "despublicado" que roto.
router.delete('/:id', requireAuth, requirePermission('Administrar base de conocimiento'), async (req, res) => {
  try {
    const [[existing]]: any = await pool.query('SELECT id FROM kb_articles WHERE id = ? LIMIT 1', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Artículo no encontrado' } });
    await pool.query('UPDATE kb_articles SET status = ? WHERE id = ?', ['draft', req.params.id]);
    res.status(204).end();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error archiving KB article' } });
  }
});

export default router;
