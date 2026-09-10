import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';

interface Category { id: number; name: string; business_area_id: number | null }
interface Subcategory { id: number; category_id: number; name: string }
interface ArticleSummary {
  id: number; title: string; snippet: string; category_id: number | null; category_name: string | null;
  subcategory_id: number | null; subcategory_name: string | null; status: 'draft' | 'published'; updated_at: string;
}
interface Article extends Omit<ArticleSummary, 'snippet'> { body: string }

let profile: { role?: string } = {};
try { profile = JSON.parse(localStorage.getItem('auth_profile') || '{}'); } catch { profile = {}; }
// Mismo criterio de permisos que el backend (administrator/supervisor
// pueden gestionar la KB, ver backend/src/routes/kbArticles.ts) pero
// evaluado del lado del cliente sólo para decidir qué controles mostrar --
// la autorización real siempre la hace el servidor.
const canManage = profile.role === 'administrator' || profile.role === 'supervisor';

function emptyForm() {
  return { title: '', body: '', category_id: '', subcategory_id: '', status: 'published' as 'draft' | 'published' };
}

function KnowledgeBase() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [subcategoryFilter, setSubcategoryFilter] = useState('');
  const [selected, setSelected] = useState<Article | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function load() {
    const params = new URLSearchParams();
    // Búsquedas de menos de 3 caracteres no se envían: MySQL FULLTEXT usa
    // por defecto innodb_ft_min_token_size=3 y no encontraría nada de
    // todos modos, así que en ese caso simplemente se muestra la lista sin
    // filtrar por texto.
    if (query.trim().length >= 3) params.set('q', query.trim());
    if (categoryFilter) params.set('category_id', categoryFilter);
    if (subcategoryFilter) params.set('subcategory_id', subcategoryFilter);
    api.get(`/kb-articles?${params}`)
      .then((res) => setArticles(res.data.data))
      .catch((err) => setError(err.response?.data?.error?.message || 'No se pudieron cargar los artículos'));
  }

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data.data)).catch(() => setCategories([]));
    api.get('/subcategories').then((res) => setSubcategories(res.data.data)).catch(() => setSubcategories([]));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(load, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, categoryFilter, subcategoryFilter]);

  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId) openArticle(Number(openId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openArticle(id: number) {
    api.get(`/kb-articles/${id}`).then((res) => {
      setSelected(res.data.data);
      setSearchParams({ open: String(id) });
    }).catch((err) => setError(err.response?.data?.error?.message || 'No se pudo abrir el artículo'));
  }

  function closeArticle() {
    setSelected(null);
    searchParams.delete('open');
    setSearchParams(searchParams);
  }

  function startEdit(article: Article) {
    setEditingId(article.id);
    setForm({
      title: article.title, body: article.body,
      category_id: article.category_id ? String(article.category_id) : '',
      subcategory_id: article.subcategory_id ? String(article.subcategory_id) : '',
      status: article.status,
    });
  }

  const subcategoryOptions = form.category_id ? subcategories.filter((item) => String(item.category_id) === form.category_id) : [];

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      title: form.title, body: form.body,
      category_id: form.category_id || null,
      subcategory_id: form.subcategory_id || null,
      status: form.status,
    };
    try {
      if (editingId) await api.patch(`/kb-articles/${editingId}`, payload);
      else await api.post('/kb-articles', payload);
      setForm(emptyForm());
      setEditingId(null);
      load();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'No se pudo guardar el artículo');
    } finally {
      setSaving(false);
    }
  }

  async function archive(article: ArticleSummary) {
    if (!window.confirm(`¿Despublicar "${article.title}"? Deja de aparecer para el resto, pero no se borra.`)) return;
    try {
      await api.delete(`/kb-articles/${article.id}`);
      load();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'No se pudo despublicar el artículo');
    }
  }

  if (selected) {
    return (
      <div className="page-stack narrow">
        <div className="page-header"><div><p className="eyebrow">Base de conocimiento</p><h1>{selected.title}</h1></div><button type="button" className="button ghost" onClick={closeArticle}>← Volver</button></div>
        {(selected.category_name || selected.subcategory_name) && (
          <p className="subtitle">{[selected.category_name, selected.subcategory_name].filter(Boolean).join(' · ')}</p>
        )}
        <div className="panel" style={{ whiteSpace: 'pre-wrap' }}>{selected.body}</div>
        {canManage && <div className="form-actions"><button type="button" className="button secondary" onClick={() => { startEdit(selected); closeArticle(); }}>Editar</button></div>}
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="page-header enterprise-header">
        <div><p className="eyebrow">Autoservicio</p><h1>Base de conocimiento</h1><p className="subtitle">Busca antes de abrir un ticket — puede que ya exista la respuesta.</p></div>
      </div>

      {error && <p className="error loading-row">{error}</p>}

      <div className="panel filters enterprise-filters" style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <label>Buscar<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Escribe al menos 3 letras" /></label>
        <label>Categoría<select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setSubcategoryFilter(''); }}><option value="">Todas</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Subcategoría<select value={subcategoryFilter} onChange={(e) => setSubcategoryFilter(e.target.value)} disabled={!categoryFilter}><option value="">Todas</option>{subcategories.filter((s) => String(s.category_id) === categoryFilter).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      </div>

      {canManage && (
        <form onSubmit={submit} className="panel form-grid">
          <p className="eyebrow full">{editingId ? 'Editar artículo' : 'Nuevo artículo'}</p>
          <label className="full">Título<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej. Cómo restablecer mi contraseña de red" /></label>
          <label className="full">Contenido<textarea required rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Pasos para resolverlo" /></label>
          <label>Categoría (opcional)<select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value, subcategory_id: '' })}><option value="">General, sin categoría</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Subcategoría (opcional)<select value={form.subcategory_id} onChange={(e) => setForm({ ...form, subcategory_id: e.target.value })} disabled={!form.category_id}><option value="">Cualquiera</option>{subcategoryOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label>Estado<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'draft' | 'published' })}><option value="published">Publicado</option><option value="draft">Borrador</option></select></label>
          <div className="form-actions full">
            {editingId && <button type="button" className="button ghost" onClick={() => { setEditingId(null); setForm(emptyForm()); }}>Cancelar edición</button>}
            <button className="button" type="submit" disabled={saving}>{saving ? 'Guardando…' : editingId ? 'Guardar cambios' : '+ Publicar artículo'}</button>
          </div>
        </form>
      )}

      <div className="panel table-wrap enterprise-table-wrap">
        <table className="table enterprise-table">
          <thead><tr><th>Título</th><th>Categoría</th>{canManage && <th>Estado</th>}<th></th></tr></thead>
          <tbody>
            {articles.map((article) => (
              <tr key={article.id}>
                <td><button type="button" className="link-button" onClick={() => openArticle(article.id)}>{article.title}</button><br /><small className="table-subline">{article.snippet}…</small></td>
                <td>{[article.category_name, article.subcategory_name].filter(Boolean).join(' · ') || <span className="unassigned-label">General</span>}</td>
                {canManage && <td>{article.status === 'published' ? 'Publicado' : 'Borrador'}</td>}
                <td>{canManage && <button type="button" className="filter-clear" onClick={() => archive(article)}>Despublicar</button>}</td>
              </tr>
            ))}
            {!articles.length && <tr><td colSpan={canManage ? 4 : 3} className="loading-row">Sin artículos que coincidan.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default KnowledgeBase;
