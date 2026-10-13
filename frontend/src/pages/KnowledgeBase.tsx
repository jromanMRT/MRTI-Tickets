import { type ColumnDef } from '@tanstack/react-table';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import api from '../services/api';
import { kbKeys, catalogKeys } from '@/lib/query-keys';
import { articleSchema, type ArticleFormData } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SelectNative } from '@/components/ui/select-native';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/ui/form-field';
import { DataTable } from '@/components/ui/data-table';
import { exportCsv } from '@/lib/export-csv';

interface Category { id: number; name: string; business_area_id: number | null }
interface Subcategory { id: number; category_id: number; name: string }
interface ArticleSummary {
  id: number; title: string; snippet: string; category_id: number | null; category_name: string | null;
  subcategory_id: number | null; subcategory_name: string | null; status: 'draft' | 'published';
  source_ticket_id: number | null; updated_at: string;
}
interface Article extends Omit<ArticleSummary, 'snippet'> { body: string }

let profile: { role?: string } = {};
try { profile = JSON.parse(localStorage.getItem('auth_profile') || '{}'); } catch { profile = {}; }
const canManage = profile.role === 'administrator' || profile.role === 'supervisor';

function KnowledgeBase() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [subcategoryFilter, setSubcategoryFilter] = useState('');
  const [selected, setSelected] = useState<Article | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const articleForm = useForm<ArticleFormData>({
    resolver: zodResolver(articleSchema),
    defaultValues: { title: '', body: '', category_id: '', subcategory_id: '', status: 'published' },
  });
  const formCategoryId = articleForm.watch('category_id');

  const listParams = (() => {
    const p = new URLSearchParams();
    if (query.trim().length >= 3) p.set('q', query.trim());
    if (categoryFilter) p.set('category_id', categoryFilter);
    if (subcategoryFilter) p.set('subcategory_id', subcategoryFilter);
    return p.toString();
  })();

  const { data: articles = [] } = useQuery({
    queryKey: kbKeys.list(listParams),
    queryFn: () => api.get(`/kb-articles?${listParams}`).then((res) => res.data.data as ArticleSummary[]),
  });

  const { data: categories = [] } = useQuery({
    queryKey: catalogKeys.categories(),
    queryFn: () => api.get('/categories').then((res) => res.data.data as Category[]),
    staleTime: 300_000,
  });

  const { data: subcategories = [] } = useQuery({
    queryKey: catalogKeys.subcategories(),
    queryFn: () => api.get('/subcategories').then((res) => res.data.data as Subcategory[]),
    staleTime: 300_000,
  });

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
    articleForm.reset({
      title: article.title, body: article.body,
      category_id: article.category_id ? String(article.category_id) : '',
      subcategory_id: article.subcategory_id ? String(article.subcategory_id) : '',
      status: article.status,
    });
  }

  const subcategoryOptions = formCategoryId ? subcategories.filter((item) => String(item.category_id) === formCategoryId) : [];

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => {
      if (editingId) return api.patch(`/kb-articles/${editingId}`, payload);
      return api.post('/kb-articles', payload);
    },
    onSuccess: () => {
      articleForm.reset();
      setEditingId(null);
      setError('');
      void qc.invalidateQueries({ queryKey: kbKeys.lists() });
      toast.success(editingId ? 'Artículo actualizado' : 'Artículo publicado');
    },
    onError: (err: any) => { const msg = err.response?.data?.error?.message || 'No se pudo guardar el artículo'; setError(msg); toast.error(msg); },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/kb-articles/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: kbKeys.lists() });
      toast.success('Artículo despublicado');
    },
    onError: (err: any) => { const msg = err.response?.data?.error?.message || 'No se pudo despublicar el artículo'; setError(msg); toast.error(msg); },
  });

  function onArticleSubmit(data: ArticleFormData) {
    setError('');
    saveMutation.mutate({
      title: data.title, body: data.body,
      category_id: data.category_id || null,
      subcategory_id: data.subcategory_id || null,
      status: data.status,
    });
  }

  function archive(article: ArticleSummary) {
    if (!window.confirm(`¿Despublicar "${article.title}"? Deja de aparecer para el resto, pero no se borra.`)) return;
    archiveMutation.mutate(article.id);
  }

  const kbColumns = useMemo<ColumnDef<ArticleSummary>[]>(() => {
    const cols: ColumnDef<ArticleSummary>[] = [
      {
        accessorKey: 'title',
        header: 'Título',
        enableColumnFilter: true,
        meta: { filterVariant: 'text', filterPlaceholder: 'Título' },
        cell: ({ row }) => {
          const a = row.original;
          return (
            <div>
              <button type="button" className="text-sm font-bold text-ore-600 hover:underline dark:text-ore-300 cursor-pointer bg-transparent border-0 text-left" onClick={() => openArticle(a.id)}>{a.title}</button>
              {a.source_ticket_id && <Badge variant="outline" className="ml-2 text-[0.66rem]">Auto-generado</Badge>}
              <small className="mt-0.5 block text-xs text-stone-400">{a.snippet}…</small>
            </div>
          );
        },
      },
      {
        accessorKey: 'category_name',
        header: 'Categoría',
        enableColumnFilter: true,
        meta: { filterVariant: 'text', filterPlaceholder: 'Categoría' },
        cell: ({ row }) => {
          const a = row.original;
          return (
            <span className="text-sm text-stone-600 dark:text-stone-300">
              {[a.category_name, a.subcategory_name].filter(Boolean).join(' · ') || <span className="font-bold text-mrt-warn dark:text-mrt-warn-light">General</span>}
            </span>
          );
        },
      },
    ];
    if (canManage) {
      cols.push({
        accessorKey: 'status',
        header: 'Estado',
        enableColumnFilter: true,
        meta: { filterVariant: 'select', filterOptions: [{ value: 'published', label: 'Publicado' }, { value: 'draft', label: 'Borrador' }] },
        cell: ({ row }) => row.original.status === 'published' ? <Badge variant="success">Publicado</Badge> : <Badge variant="default">Borrador</Badge>,
      });
      cols.push({
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <Button variant="ghost" size="sm" onClick={() => archive(row.original)}><Trash2 className="mr-1 h-3 w-3" /> Despublicar</Button>
        ),
      });
    }
    return cols;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  function handleExportCsv() {
    const headers = ['Título', 'Categoría', 'Subcategoría', 'Estado', 'Actualizado'];
    const rows = articles.map((a) => [
      a.title, a.category_name || '', a.subcategory_name || '', a.status,
      new Date(a.updated_at).toLocaleDateString('es-MX'),
    ]);
    exportCsv(`kb-articles-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  }

  if (selected) {
    return (
      <div className="mx-auto grid max-w-[920px] gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-ore-500 dark:text-ore-300">Base de conocimiento</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-stone-900 dark:text-stone-50">{selected.title}</h1>
            {(selected.category_name || selected.subcategory_name) && (
              <p className="mt-1 text-sm text-stone-400">{[selected.category_name, selected.subcategory_name].filter(Boolean).join(' · ')}</p>
            )}
            {selected.source_ticket_id && (
              <p className="mt-1 text-sm"><a href={`/tickets/${selected.source_ticket_id}`} className="text-ore-600 hover:underline dark:text-ore-300">Ver ticket de origen</a></p>
            )}
          </div>
          <Button variant="ghost" onClick={closeArticle}><ArrowLeft className="mr-1 h-3.5 w-3.5" /> Volver</Button>
        </div>
        <Card className="whitespace-pre-wrap text-sm leading-relaxed text-stone-600 dark:text-stone-300">{selected.body}</Card>
        {canManage && (
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => { startEdit(selected); closeArticle(); }}>Editar</Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-ore-500 dark:text-ore-300">Autoservicio</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-stone-900 dark:text-stone-50">Base de conocimiento</h1>
          <p className="mt-1 text-sm text-stone-400">Busca antes de abrir un ticket — puede que ya exista la respuesta.</p>
        </div>
      </div>

      {error && <p className="text-sm text-mrt-bad dark:text-mrt-bad-light">{error}</p>}

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Label>Buscar
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Escribe al menos 3 letras" className="pl-9" />
            </div>
          </Label>
          <Label>Categoría
            <SelectNative value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setSubcategoryFilter(''); }}>
              <option value="">Todas</option>
              {categories.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </SelectNative>
          </Label>
          <Label>Subcategoría
            <SelectNative value={subcategoryFilter} onChange={(e) => setSubcategoryFilter(e.target.value)} disabled={!categoryFilter}>
              <option value="">Todas</option>
              {subcategories.filter((s) => String(s.category_id) === categoryFilter).map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
            </SelectNative>
          </Label>
        </div>
      </Card>

      {/* Admin form */}
      {canManage && (
        <Card className="p-6">
          <form onSubmit={articleForm.handleSubmit(onArticleSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <p className="col-span-full text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-ore-500 dark:text-ore-300">{editingId ? 'Editar artículo' : 'Nuevo artículo'}</p>
            <div className="col-span-full">
              <Label>Título
                <Input {...articleForm.register('title')} placeholder="Ej. Cómo restablecer mi contraseña de red" />
              </Label>
              <FieldError error={articleForm.formState.errors.title} />
            </div>
            <div className="col-span-full">
              <Label>Contenido
                <Textarea {...articleForm.register('body')} rows={6} placeholder="Pasos para resolverlo" />
              </Label>
              <FieldError error={articleForm.formState.errors.body} />
            </div>
            <Label>Categoría (opcional)
              <SelectNative {...articleForm.register('category_id', { onChange: () => articleForm.setValue('subcategory_id', '') })}>
                <option value="">General, sin categoría</option>
                {categories.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
              </SelectNative>
            </Label>
            <Label>Subcategoría (opcional)
              <SelectNative {...articleForm.register('subcategory_id')} disabled={!formCategoryId}>
                <option value="">Cualquiera</option>
                {subcategoryOptions.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
              </SelectNative>
            </Label>
            <Label>Estado
              <SelectNative {...articleForm.register('status')}>
                <option value="published">Publicado</option>
                <option value="draft">Borrador</option>
              </SelectNative>
            </Label>
            <div className="col-span-full flex justify-end gap-3">
              {editingId && <Button type="button" variant="ghost" onClick={() => { setEditingId(null); articleForm.reset(); }}>Cancelar edición</Button>}
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Guardando…' : editingId ? 'Guardar cambios' : '+ Publicar artículo'}</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Articles table */}
      <DataTable
        columns={kbColumns}
        data={articles}
        pageSize={20}
        emptyTitle="Sin artículos que coincidan"
        emptyDescription="Intenta con otros filtros o crea un nuevo artículo."
        onExportCsv={handleExportCsv}
        enableRowSelection
        getRowId={(article) => String(article.id)}
        tableId="knowledge-base"
      />
    </div>
  );
}

export default KnowledgeBase;
