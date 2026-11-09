import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('../config/db', () => ({ default: { query: mocks.query } }));

import { maybeCreateKbDraft } from './kbAutoArticle';

const ticket = {
  id: 42,
  folio: 'MRTI-2026-000042',
  title: 'VPN sin conexión',
  description: 'No conecta desde oficina',
  category_id: 3,
  subcategory_id: null,
  assigned_to: 'tech-1',
  assigned_to_name: 'Técnico',
  category_name: 'Redes',
  subcategory_name: null,
};

function arrange({ publicComments = [{ content: 'Se renovó el perfil VPN', author_name: 'Soporte', created_at: '2026-11-09T12:00:00Z' }], resolution = 'Perfil renovado' } = {}) {
  mocks.query.mockImplementation(async (sql: string) => {
    if (/SELECT id FROM kb_articles/.test(sql)) return [[]];
    if (/FROM tickets t/.test(sql)) return [[ticket]];
    if (/FROM ticket_comments/.test(sql)) {
      return [/is_private\s*=\s*0/.test(sql)
        ? publicComments
        : [...publicComments, { content: 'SECRETO INTERNO', author_name: 'Soporte', created_at: '2026-11-09T11:00:00Z' }]];
    }
    if (/FROM ticket_status_history/.test(sql)) return [[...(resolution ? [{ comment: resolution }] : [])]];
    if (/INSERT INTO kb_articles/.test(sql)) return [{ insertId: 77 }];
    return [[]];
  });
}

describe('borradores automáticos de base de conocimiento', () => {
  beforeEach(() => vi.clearAllMocks());

  it('consulta únicamente comentarios públicos y nunca incorpora notas internas', async () => {
    arrange();

    await expect(maybeCreateKbDraft(42)).resolves.toBe(77);

    const commentQuery = mocks.query.mock.calls.find(([sql]) => /FROM ticket_comments/.test(sql));
    expect(commentQuery?.[0]).toMatch(/is_private\s*=\s*0/);
    const insert = mocks.query.mock.calls.find(([sql]) => /INSERT INTO kb_articles/.test(sql));
    expect(insert?.[1]?.[1]).toContain('Se renovó el perfil VPN');
    expect(insert?.[1]?.[1]).not.toContain('SECRETO INTERNO');
  });

  it('no crea un borrador cuando sólo existirían notas internas y no hay resolución pública', async () => {
    arrange({ publicComments: [], resolution: '' });

    await expect(maybeCreateKbDraft(42)).resolves.toBeNull();
    expect(mocks.query.mock.calls.some(([sql]) => /INSERT INTO kb_articles/.test(sql))).toBe(false);
  });
});
