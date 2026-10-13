import { useEffect, useMemo, useState } from 'react';
import {
  type ColumnDef, type ColumnFiltersState, type OnChangeFn, type RowData,
  type RowSelectionState, type SortingState, flexRender, getCoreRowModel,
  getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Rows3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    filterVariant?: 'text' | 'select';
    filterOptions?: ReadonlyArray<{ label: string; value: string }>;
    filterPlaceholder?: string;
  }
}

export type { ColumnDef, ColumnFiltersState, SortingState };
type Density = 'comfortable' | 'compact';

interface DataTableProps<TData extends RowData> {
  columns: ColumnDef<TData, unknown>[]; data: TData[];
  sorting?: SortingState; onSortingChange?: OnChangeFn<SortingState>; manualSorting?: boolean;
  columnFilters?: ColumnFiltersState; onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>; manualFiltering?: boolean;
  pageSize?: number; manualPagination?: boolean; pageCount?: number; page?: number; onPageChange?: (page: number) => void; totalRows?: number;
  emptyTitle?: string; emptyDescription?: string; minWidth?: string; onExportCsv?: () => void;
  enableRowSelection?: boolean; getRowId?: (originalRow: TData, index: number, parent?: any) => string; onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  tableId?: string; className?: string;
}

function SortIcon({ direction }: { direction: false | 'asc' | 'desc' }) {
  if (direction === 'asc') return <ArrowUp className="ml-1 inline h-3 w-3" />;
  if (direction === 'desc') return <ArrowDown className="ml-1 inline h-3 w-3" />;
  return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-30" />;
}
function readDensity(tableId?: string): Density {
  if (!tableId || typeof window === 'undefined') return 'comfortable';
  return window.localStorage.getItem(`mrti.table-density.${tableId}`) === 'compact' ? 'compact' : 'comfortable';
}

export function DataTable<TData extends RowData>(props: DataTableProps<TData>) {
  const { columns, data, sorting: externalSorting, onSortingChange: externalOnSortingChange, manualSorting = false,
    columnFilters: externalColumnFilters, onColumnFiltersChange: externalOnColumnFiltersChange, manualFiltering = false,
    pageSize = 25, manualPagination = false, pageCount: externalPageCount, page: externalPage, onPageChange, totalRows,
    emptyTitle = 'Sin resultados', emptyDescription = 'No hay datos para mostrar.', minWidth = '760px', onExportCsv,
    enableRowSelection = false, getRowId, onRowSelectionChange, tableId, className } = props;
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [internalColumnFilters, setInternalColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [density, setDensity] = useState<Density>(() => readDensity(tableId));
  const sorting = externalSorting ?? internalSorting;
  const columnFilters = externalColumnFilters ?? internalColumnFilters;
  const onSortingChange = externalOnSortingChange ?? setInternalSorting;
  const onColumnFiltersChange = externalOnColumnFiltersChange ?? setInternalColumnFilters;
  useEffect(() => { setDensity(readDensity(tableId)); }, [tableId]);
  useEffect(() => { if (tableId) window.localStorage.setItem(`mrti.table-density.${tableId}`, density); }, [density, tableId]);

  const selectionColumn = useMemo<ColumnDef<TData, unknown>>(() => ({
    id: '__selection',
    header: ({ table }) => <input aria-label="Seleccionar filas visibles" type="checkbox" checked={table.getIsAllPageRowsSelected()} ref={(node) => { if (node) node.indeterminate = table.getIsSomePageRowsSelected(); }} onChange={table.getToggleAllPageRowsSelectedHandler()} />,
    cell: ({ row }) => <input aria-label="Seleccionar fila" type="checkbox" checked={row.getIsSelected()} disabled={!row.getCanSelect()} onChange={row.getToggleSelectedHandler()} />,
    enableSorting: false, enableColumnFilter: false, enableResizing: false, size: 46, minSize: 46, maxSize: 46,
  }), []);
  const tableColumns = useMemo(() => enableRowSelection ? [selectionColumn, ...columns] : columns, [columns, enableRowSelection, selectionColumn]);
  const table = useReactTable({
    data, columns: tableColumns,
    state: { sorting, columnFilters, rowSelection, ...(manualPagination && externalPage != null ? { pagination: { pageIndex: externalPage - 1, pageSize } } : {}) },
    onSortingChange, onColumnFiltersChange,
    onRowSelectionChange: (updater) => { setRowSelection(updater); onRowSelectionChange?.(updater); },
    getRowId, enableRowSelection, columnResizeMode: 'onChange', manualSorting, manualFiltering, manualPagination, pageCount: externalPageCount,
    getCoreRowModel: getCoreRowModel(), getFilteredRowModel: manualFiltering ? undefined : getFilteredRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(), getPaginationRowModel: manualPagination ? undefined : getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });
  const rows = table.getRowModel().rows;
  const currentPage = manualPagination ? (externalPage ?? 1) : table.getState().pagination.pageIndex + 1;
  const totalPages = manualPagination ? (externalPageCount ?? 1) : table.getPageCount();
  const selectedCount = table.getSelectedRowModel().rows.length;
  const cellPadding = density === 'compact' ? 'px-4 py-2' : 'px-4 py-3';

  return <div className={cn('overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-stone-600 dark:bg-stone-800', className)}>
    <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm text-stone-500">
      <span><strong className="text-stone-800 dark:text-stone-100">{totalRows ?? data.length}</strong> resultados{selectedCount > 0 && <span className="ml-2 text-ore-600 dark:text-ore-300">· {selectedCount} seleccionados</span>}</span>
      <div className="flex items-center gap-2"><span className="hidden items-center gap-1 text-xs sm:flex"><Rows3 className="h-3.5 w-3.5" /> Densidad</span><div className="flex rounded-md border border-stone-200 p-0.5 dark:border-stone-600" aria-label="Densidad de filas"><button type="button" aria-pressed={density === 'comfortable'} onClick={() => setDensity('comfortable')} className={cn('rounded px-2 py-1 text-xs font-semibold', density === 'comfortable' && 'bg-stone-100 text-stone-800 dark:bg-stone-700 dark:text-stone-100')}>Cómoda</button><button type="button" aria-pressed={density === 'compact'} onClick={() => setDensity('compact')} className={cn('rounded px-2 py-1 text-xs font-semibold', density === 'compact' && 'bg-stone-100 text-stone-800 dark:bg-stone-700 dark:text-stone-100')}>Compacta</button></div>{totalPages > 1 && <small className="text-stone-400">Página {currentPage} de {totalPages}</small>}{onExportCsv && <Button variant="ghost" size="sm" onClick={onExportCsv}><Download className="mr-1 h-3 w-3" /> CSV</Button>}</div>
    </div>
    {rows.length === 0 ? <div className="py-10 text-center"><h2 className="text-base font-bold text-stone-800 dark:text-stone-100">{emptyTitle}</h2><p className="mt-1 text-sm text-stone-400">{emptyDescription}</p></div> : <div className="overflow-x-auto"><table className="w-full border-collapse text-left" style={{ minWidth }}><thead>{table.getHeaderGroups().map((group) => <><tr key={group.id} className="border-b border-stone-100 dark:border-stone-700">{group.headers.map((header) => <th key={header.id} className={cn('relative px-4 py-3 text-[0.68rem] font-extrabold uppercase tracking-wider text-stone-400', header.column.getCanSort() && 'select-none')} style={{ width: header.getSize() }}>{header.isPlaceholder ? null : <button type="button" onClick={header.column.getToggleSortingHandler()} className={cn('inline-flex items-center text-left', header.column.getCanSort() && 'cursor-pointer hover:text-stone-600 dark:hover:text-stone-200')} disabled={!header.column.getCanSort()}>{flexRender(header.column.columnDef.header, header.getContext())}{header.column.getCanSort() && <SortIcon direction={header.column.getIsSorted()} />}</button>}{header.column.getCanResize() && <div role="separator" aria-orientation="vertical" aria-label="Redimensionar columna" onDoubleClick={() => header.column.resetSize()} onMouseDown={header.getResizeHandler()} onTouchStart={header.getResizeHandler()} className={cn('absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none hover:bg-ore-300', header.column.getIsResizing() && 'bg-ore-400')} />}</th>)}</tr><tr key={`${group.id}-filters`} className="border-b border-stone-100 bg-stone-50/60 dark:border-stone-700 dark:bg-stone-700/20">{group.headers.map((header) => { const column = header.column; const meta = column.columnDef.meta; return <th key={`${header.id}-filter`} className="px-3 py-2">{column.getCanFilter() && meta?.filterVariant === 'select' ? <select aria-label={`Filtrar ${column.id}`} value={(column.getFilterValue() ?? '') as string} onChange={(event) => column.setFilterValue(event.target.value || undefined)} className="w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs font-normal normal-case text-stone-600 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200"><option value="">Todos</option>{meta.filterOptions?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : column.getCanFilter() && meta?.filterVariant === 'text' ? <input aria-label={`Filtrar ${column.id}`} value={(column.getFilterValue() ?? '') as string} onChange={(event) => column.setFilterValue(event.target.value || undefined)} placeholder={meta.filterPlaceholder || 'Filtrar'} className="w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs font-normal normal-case text-stone-600 placeholder:text-stone-400 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200" /> : null}</th>; })}</tr></>)}</thead><tbody>{rows.map((row) => <tr key={row.id} data-state={row.getIsSelected() ? 'selected' : undefined} className="border-b border-stone-100 transition-colors hover:bg-stone-50/60 data-[state=selected]:bg-ore-50 dark:border-stone-700 dark:hover:bg-stone-700/30 dark:data-[state=selected]:bg-ore-900/20">{row.getVisibleCells().map((cell) => <td key={cell.id} className={cellPadding}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody></table></div>}
    {totalPages > 1 && <nav className="flex items-center justify-center gap-4 border-t border-stone-100 px-4 py-3 dark:border-stone-700" aria-label="Paginación"><Button variant="secondary" size="sm" disabled={currentPage <= 1} onClick={() => { if (manualPagination && onPageChange) onPageChange(currentPage - 1); else table.previousPage(); }}>← Anterior</Button><span className="text-xs text-stone-400">{currentPage} / {totalPages}</span><Button variant="secondary" size="sm" disabled={currentPage >= totalPages} onClick={() => { if (manualPagination && onPageChange) onPageChange(currentPage + 1); else table.nextPage(); }}>Siguiente →</Button></nav>}
  </div>;
}
