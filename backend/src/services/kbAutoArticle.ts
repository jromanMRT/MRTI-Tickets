import pool from '../config/db';

/**
 * Crea un borrador de artículo KB a partir de un ticket que acaba de
 * resolverse (RESOLVED). Solo se genera si:
 *  - El ticket tiene categoría asignada
 *  - No existe ya un artículo KB vinculado a este ticket
 *  - Hay al menos un comentario de resolución (el motivo del cambio a RESOLVED)
 *
 * El artículo queda en status='draft' para revisión humana.
 * Devuelve el id del artículo creado, o null si no se generó.
 */
export async function maybeCreateKbDraft(ticketId: number): Promise<number | null> {
  try {
    const [[existing]]: any = await pool.query(
      'SELECT id FROM kb_articles WHERE source_ticket_id = ? LIMIT 1',
      [ticketId]
    );
    if (existing) return null;

    const [[ticket]]: any = await pool.query(
      `SELECT t.id, t.folio, t.title, t.description, t.category_id, t.subcategory_id,
              t.assigned_to, t.assigned_to_name,
              c.name AS category_name, sc.name AS subcategory_name
         FROM tickets t
         LEFT JOIN ticket_categories c ON c.id = t.category_id
         LEFT JOIN ticket_subcategories sc ON sc.id = t.subcategory_id
        WHERE t.id = ? AND t.deleted_at IS NULL`,
      [ticketId]
    );
    if (!ticket || !ticket.category_id) return null;

    const [comments]: any = await pool.query(
      `SELECT content, author_name, created_at FROM ticket_comments
        WHERE ticket_id = ? ORDER BY created_at ASC`,
      [ticketId]
    );

    const [resolutionHistory]: any = await pool.query(
      `SELECT h.comment FROM ticket_status_history h
         JOIN ticket_statuses s ON s.id = h.to_status_id
        WHERE h.ticket_id = ? AND s.code = 'RESOLVED'
        ORDER BY h.created_at DESC LIMIT 1`,
      [ticketId]
    );

    const resolutionComment = resolutionHistory[0]?.comment || '';
    const publicComments = comments.filter((c: any) => c.content);

    if (!resolutionComment && !publicComments.length) return null;

    const body = buildArticleBody(ticket, resolutionComment, publicComments);

    const [result]: any = await pool.query(
      `INSERT INTO kb_articles (title, body, category_id, subcategory_id, status, created_by, source_ticket_id)
       VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
      [
        ticket.title,
        body,
        ticket.category_id,
        ticket.subcategory_id || null,
        ticket.assigned_to || null,
        ticketId,
      ]
    );

    return result.insertId;
  } catch (err) {
    console.error('[kbAutoArticle] Error creating draft from ticket', ticketId, err);
    return null;
  }
}

function buildArticleBody(
  ticket: any,
  resolutionComment: string,
  comments: Array<{ content: string; author_name: string; created_at: string }>
): string {
  const sections: string[] = [];

  sections.push('## Problema reportado');
  sections.push(ticket.description || ticket.title);

  if (ticket.category_name) {
    const classification = [ticket.category_name, ticket.subcategory_name].filter(Boolean).join(' > ');
    sections.push(`\nClasificación: ${classification}`);
  }

  if (resolutionComment) {
    sections.push('\n## Solución');
    sections.push(resolutionComment);
  }

  if (comments.length) {
    sections.push('\n## Notas del seguimiento');
    for (const c of comments.slice(-10)) {
      const date = new Date(c.created_at).toLocaleDateString('es-MX');
      sections.push(`- [${date}] ${c.author_name || 'Sistema'}: ${c.content}`);
    }
  }

  sections.push(`\n---\nGenerado automáticamente desde el ticket ${ticket.folio}.`);

  return sections.join('\n');
}
