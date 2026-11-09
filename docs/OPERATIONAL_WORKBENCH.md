# Mesa operativa de Tickets

## Alcance

La bandeja incorpora una vista maestra–detalle sin cambiar la propiedad de
ningún dato maestro. Tickets conserva únicamente las referencias estables y el
contexto capturado en el ticket; Core sigue siendo propietario de usuarios y
Activos del inventario patrimonial.

La entrega agrega:

- panel lateral con conversación, notas internas, adjuntos, actividad, SLA,
  asignación y cambio de estado;
- búsqueda operativa sobre tickets y sus referencias capturadas, además de
  artículos publicados de la base de conocimiento;
- selección y asignación, escalamiento o exportación por lote;
- escalamiento independiente del estado, etiquetas locales y relaciones entre
  tickets;
- sugerencias de tickets similares limitadas al alcance por área del usuario.

No existen llaves foráneas hacia Core, Activos, Monitor ni otro módulo. Las
únicas llaves nuevas relacionan tablas dentro de `mrti_tickets`.

## Migración

`014_operational_workbench.sql` es aditiva e idempotente. Agrega tres columnas
opcionales a `tickets` y crea `ticket_tags`, `ticket_tag_links` y
`ticket_relations`. No reescribe tickets históricos ni crea etiquetas o
relaciones supuestas.

Verificación mínima después de aplicarla:

```sql
SELECT COUNT(*) FROM information_schema.columns
 WHERE table_schema='mrti_tickets' AND table_name='tickets'
   AND column_name IN ('escalated_at','escalated_by','escalation_reason');
SELECT COUNT(*) FROM ticket_tags;
SELECT COUNT(*) FROM ticket_tag_links;
SELECT COUNT(*) FROM ticket_relations;
```

El primer conteo debe ser `3`. Los otros pueden ser `0`: no se precargan datos
operativos.

## Publicación

1. Aplicar y repetir la migración para probar idempotencia.
2. Publicar el backend y confirmar health, sesión, búsqueda y protección sin
   token.
3. Publicar el frontend desde un commit limpio.
4. Probar apertura/cierre del panel, cambio de estado, asignación, comentario,
   adjunto, escalamiento, etiqueta y relación con fixtures eliminables.
5. Revisar logs del backend, frontend y Nginx.

## Rollback

Reponer las imágenes anteriores de backend y frontend. El código anterior
ignora las columnas y tablas nuevas; no deben eliminarse para revertir. Los
escalamientos, etiquetas y relaciones creados durante la ventana quedan
conservados para auditoría y vuelven a aparecer al restaurar esta versión.

Si se necesita deshabilitar la función sin cambiar imágenes, se puede negar la
sección existente **Bandeja y atención de tickets** en Core. No se retiran
rutas antiguas ni se cambian UUID.
