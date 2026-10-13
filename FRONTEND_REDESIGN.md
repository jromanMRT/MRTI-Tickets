# MRTI Tickets — Rediseño Frontend

## Arquitectura objetivo

```
React 18 + Vite 5
├── Tailwind CSS v4         → Diseño y estilos
├── shadcn/ui               → Componentes visuales (Button, Card, Dialog, Badge, Tooltip, etc.)
├── TanStack Query          → Consultas y caché API
├── TanStack Table          → Tablas avanzadas (sort, resize, filtros inline)
├── React Hook Form + Zod   → Formularios y validación
├── Recharts                → Gráficas y estadísticas
└── API REST / Node.js + Express (backend sin cambios)
    └── MySQL (Tickets DB)
```

## Paleta de marca MRT (del logo)

```
Ore (dorado mineral):  #f3d68d → #c9972f → #6e4d16
Stone (piedra oscura): #4a3a22 → #211a11
Accent dorado:         #d9a63c
Fondo claro:           #f6f2e7 / #fffdf7
```

## Progreso por fase

### Fase 1: Base visual — Tailwind + Recharts ✅ COMPLETADA
- [x] Instalar Recharts — `npm install recharts`
- [x] Instalar Tailwind CSS v4 — `npm install -D tailwindcss @tailwindcss/vite`
- [x] Configurar plugin Vite (`@tailwindcss/vite` en `vite.config.ts`)
- [x] Configurar `@theme` con colores MRT (ore, stone, mrt-good, mrt-bad, etc.)
- [x] Reescribir `style.css` completo con diseño profesional
- [x] Chunk splitting: Recharts separado como lazy chunk
- [x] Dashboard: gráficas reales (AreaChart tendencia, BarChart horizontal áreas/carga, PieChart prioridad)
- [x] Dashboard: KPI cards con Tailwind (gradientes, hover, animaciones)
- [x] Dashboard: Queue cards con Tailwind
- [x] App.tsx: iconos SVG inline (reemplazó Unicode)
- [x] Build exitoso, containers Docker rebuildeados
- **Commit pendiente**: cambios en frontend/, vite.config.ts, style.css, Dashboard.tsx, App.tsx, package.json

### Fase 2: shadcn/ui — Componentes profesionales ✅ COMPLETADA
- [x] Dependencias: class-variance-authority, clsx, tailwind-merge, lucide-react, @radix-ui/* (slot, dialog, tabs, tooltip, dropdown-menu, select, label, separator)
- [x] `@/` path alias (tsconfig paths + vite resolve.alias + vitest resolve.alias)
- [x] `cn()` utility en `src/lib/utils.ts`
- [x] 14 componentes UI en `src/components/ui/`: Button (5 variantes + 4 tamaños), Badge (20+ variantes: status, priority, SLA, semantic), Card, Input, Textarea, SelectNative, Dialog, Tabs, Tooltip, Skeleton, Avatar, Label, Separator
- [x] Migrar Dashboard.tsx — StatCard, QueueCard, Badge, Skeleton, cn(), lucide-react icons
- [x] Migrar Tickets.tsx — Button, Badge, Card, Input, SelectNative, Tabs, Skeleton, lucide-react
- [x] Migrar TicketDetail.tsx — Button, Badge, Card, Input, Textarea, SelectNative, Label, Avatar, Skeleton, cn(), lucide-react (12 icons)
- [x] Migrar NewTicket.tsx — Button, Card, Input, Textarea, SelectNative, Label, lucide-react
- [x] Migrar KnowledgeBase.tsx — Button, Badge, Card, Input, Textarea, SelectNative, Label, lucide-react
- [x] Migrar SlaPolicies.tsx — Button, Badge, Card, Input, SelectNative, Label, lucide-react
- [x] Migrar App.tsx shell — 16 lucide-react icons, Button, Avatar (sidebar CSS preservado)
- [x] CSS cleanup: 631→316 líneas (eliminados ~50 bloques de clases obsoletas), build 89→66 KB
- [x] matchMedia mock en setupTests.ts para jsdom
- [x] Tests: 3/3 passing, typecheck clean, build OK

### Fase 3: TanStack Table — Tablas avanzadas ✅ COMPLETADA
- [x] Instalar `@tanstack/react-table` v8
- [x] `DataTable` componente reutilizable en `src/components/ui/data-table.tsx`:
  - Sortable column headers (click → asc/desc/none) con iconos ArrowUp/Down/UpDown
  - Client-side pagination automática (cuando data > pageSize)
  - Server-side pagination + sorting manual (para Tickets)
  - Toolbar con total, página actual, y botón CSV export
  - Estilos MRT: rounded-2xl card, stone borders, hover rows, uppercase headers
- [x] `exportCsv()` utility en `src/lib/export-csv.ts` (BOM UTF-8, escapado correcto)
- [x] Migrar Tickets.tsx → DataTable con manualSorting + manualPagination vía URL params
- [x] Migrar KnowledgeBase.tsx → DataTable con client-side sort, paginación a 20
- [x] Migrar SlaPolicies.tsx → DataTable con celdas editables inline (Input number + onBlur)
- [x] CSV export en las 3 tablas
- [x] Resize de columnas con arrastre y doble clic para restaurar el ancho
- [x] Selección local de filas mediante casillas, con contador en la barra de la tabla
- [x] Toggle de densidad cómoda/compacta, persistido por tabla en el navegador
- [x] Filtros inline por columna: locales para Base de conocimiento/SLA y sincronizados con la API para Tickets

### Fase 4: TanStack Query — Fetching profesional ✅ COMPLETADA
- [x] Instalar `@tanstack/react-query` v5.104 (sin devtools — se agregan en B6 si necesario)
- [x] Crear QueryClientProvider en main.tsx + queryClient con staleTime 30s
- [x] Crear `lib/query-keys.ts` con factory keys: ticketKeys, dashboardKeys, catalogKeys, kbKeys, slaKeys
- [x] Migrar Dashboard: `useQuery` con staleTime 60s + refetchInterval 120s (polling suave)
- [x] Migrar Tickets: `useQuery` con `placeholderData: (prev) => prev` para paginación fluida
- [x] Migrar TicketDetail: 7 `useQuery` (ticket, workflow, comments, attachments, history, sla, assignees + related asset) + 4 `useMutation` (status, comment, assign, upload) con invalidación automática
- [x] Migrar NewTicket: 5 `useQuery` para catálogos + 1 `useMutation` para submit → invalida lista de tickets
- [x] Migrar KnowledgeBase: `useQuery` para artículos/categorías + `useMutation` para save/archive
- [x] Migrar SlaPolicies: `useQuery` para políticas/áreas/categorías + 3 `useMutation` (create/update/delete)
- [x] Invalidación automática (crear ticket → invalida lista, cambiar estado → invalida detail+workflow+history+sla)
- [x] Catálogos compartidos con staleTime 5min (statuses, areas, categories, subcategories, priorities)
- [x] Tests 3/3, typecheck clean, build OK (JS 316→358 KB por TanStack Query)
- [x] `services/api.ts` conservado como cliente axios (interceptors auth/403); se usa como queryFn

### Fase 5: React Hook Form + Zod — Formularios robustos ✅ COMPLETADA (2026-10-10)
- [x] Instalar `react-hook-form` v7 + `zod` + `@hookform/resolvers`
- [x] Crear schemas Zod en `lib/schemas.ts`: ticketSchema, commentSchema, statusChangeSchema, assignSchema, articleSchema, slaPolicySchema
- [x] `FieldError` componente en `components/ui/form-field.tsx` (text-xs text-mrt-bad)
- [x] Migrar NewTicket → `useForm<TicketFormData>({ resolver: zodResolver(ticketSchema) })` con `register`, `watch`, `setValue` para cascading selects y KB suggestions
- [x] Migrar TicketDetail → 3 `useForm` hooks: commentForm, statusForm, assignForm con zodResolver; file upload queda como FormData raw
- [x] Migrar KnowledgeBase → `useForm<ArticleFormData>` con `reset()` para edición inline, `watch('category_id')` para subcategorías
- [x] Migrar SlaPolicies → `useForm<SlaPolicyFormData>` con `valueAsNumber: true` para campos numéricos, `watch('business_area_id')` para categorías
- [x] Validación inline con mensajes en español en todos los formularios
- [x] Gotchas resueltos: `.default()` incompatible con zodResolver (usar defaultValues en useForm); `z.coerce.number()` produce `unknown` input type (usar `z.number()` + `valueAsNumber: true` en register)
- [x] Tests 3/3, typecheck clean, build OK (JS 483 KB)

### Fase 6: Pulido final ✅ COMPLETADA (2026-10-11)
- [x] Toast notifications con Sonner (`sonner`) — `<Toaster position="bottom-right" richColors closeButton />`
- [x] Toasts en todas las mutations: TicketDetail (4), NewTicket (1), KnowledgeBase (2), SlaPolicies (3) — éxito y error con mensajes en español
- [x] Skeleton loaders: Dashboard (KPI cards + gráficas), Tickets (filas tabla), TicketDetail (layout 2-col) — ya existían de fases previas
- [x] Page transition: CSS keyframe `page-fade-in` (200ms ease-out, translateY 6px), keyed por `location.pathname` en App.tsx
- [x] Tests 3/3, typecheck clean, build OK (JS 519 KB + recharts 539 KB = 68 KB CSS)

### Fase 6b: Iteración — Command palette, Lighthouse, responsive phone ✅ COMPLETADA (2026-10-12)

#### Command palette (Ctrl+K)
- [x] Instalar `cmdk` v1.1.1
- [x] Componente `CommandPalette.tsx` con cmdk Dialog, integrado en App.tsx
- [x] Navegación rápida: Dashboard, Tickets, Nuevo ticket, Base de conocimiento, Políticas de SLA
- [x] Acciones: toggle tema claro/oscuro, ir al portal principal
- [x] Filtrado por búsqueda, selección con teclado ↑↓ Enter
- [x] CSS con tokens MRT (gold highlight, surface/line borders, dark mode)
- [x] Permisos respetados: items ocultos si el usuario no tiene acceso

#### Responsive phone review (320–580 px)
- [x] Dashboard: ticket rows pasan de 4-col grid a 2-col stacked en phone (badges wrap debajo del título)
- [x] Dashboard: pie chart + legend cambia de `flex-row` a `flex-col` en phone
- [x] Dashboard: YAxis width reducido de 120/110 px a 90 px para dejar más espacio a barras
- [x] Tickets: TabsList ya tenía `overflow-x-auto scrollbar-none` — agregada utilidad CSS `.scrollbar-none`
- [x] NewTicket: context info grid cambia de `grid-cols-2` a `grid-cols-1 sm:grid-cols-2`
- [x] TicketDetail: file upload form cambia de `flex-row` a `flex-col sm:flex-row`
- [x] KnowledgeBase: filtros cambian de `auto-fit minmax(160px)` a `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- [x] SlaPolicies: form cambia de `auto-fit minmax(160px)` a `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`

#### Lighthouse audit
- [x] `<html lang="es">` — ya existía ✓
- [x] `<meta name="viewport">` — ya existía ✓
- [x] `<meta name="description">` — agregada
- [x] `<meta name="theme-color">` — agregada (#211a11 stone-900)
- [x] Font preload: `<link rel="preload">` para IBM Plex Sans y Big Shoulders Display (woff2)
- [x] Focus visible: `:focus-visible` outline global (2px solid gold, offset 2px) + `:focus:not(:focus-visible)` limpia outline en click
- [x] Todas las imágenes tienen `alt` (logo decorativo con `alt=""`)
- [x] Todos los botones icon-only tienen `aria-label`
- [x] Fonts self-hosted con `font-display: swap` — ya existía ✓
- [x] Tests 4/4, build OK (JS 570 KB + recharts 539 KB + 74 KB CSS)

## Archivos clave modificados

| Archivo | Estado | Notas |
|---|---|---|
| `frontend/package.json` | Modificado | +recharts, +tailwindcss, +@tailwindcss/vite |
| `frontend/vite.config.ts` | Modificado | +tailwindcss plugin, +manualChunks recharts |
| `frontend/src/style.css` | Reescrito | +@import tailwindcss, +@theme MRT, rediseño completo |
| `frontend/src/App.tsx` | Reescrito | SVG icons, diseño mejorado |
| `frontend/src/pages/Dashboard.tsx` | Reescrito | Recharts + Tailwind KPI cards |
| `frontend/src/pages/Tickets.tsx` | Pendiente | Fase 2-3: shadcn + TanStack Table |
| `frontend/src/pages/TicketDetail.tsx` | Pendiente | Fase 2: shadcn components |
| `frontend/src/pages/NewTicket.tsx` | Pendiente | Fase 2+5: shadcn + RHF+Zod |
| `frontend/src/pages/KnowledgeBase.tsx` | Pendiente | Fase 2-3 |
| `frontend/src/pages/SlaPolicies.tsx` | Pendiente | Fase 2-3 |

## Cómo continuar

Al retomar, decir:
> "Continúa el rediseño de Tickets frontend. Lee FRONTEND_REDESIGN.md para ver el progreso."

Claude leerá este archivo, verá qué fase sigue, y continuará desde ahí.
