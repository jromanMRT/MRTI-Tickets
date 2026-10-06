# Equipo afectado para administradores

Fecha: 2026-10-06. Alcance: Crear ticket en MRTI Tickets y Nuevo ticket del
Dashboard de Core. El administrador puede buscar por código, nombre o área
y elegir un equipo ajeno o dejar el ticket sin equipo específico.

## Propiedad y compatibilidad

Core agrega `can_select_any_equipment` y `equipment_options` a
`/api/auth/ticket-context` sólo con catálogo global para `administrator`.
Consulta por HTTP los contratos existentes de Activos y Monitor. Prioriza
el UUID patrimonial (`asset:<asset_uid>`) y evita duplicar su dispositivo
vinculado; equipos sólo de Monitor usan `device:<id>`. Los IDs numéricos de
Activos nunca se guardan como `related_device_id` de Monitor.

Los POST `/api/tickets` y `/api/tickets-self` aceptan el campo aditivo
`affected_equipment`. Verifican el rol autenticado y vuelven a obtener el
catálogo antes de persistir, derivando código/nombre/UUID del servidor.
Un equipo desaparecido o un catálogo caído rechaza la selección (400);
un rol no administrador recibe 403. La opción vacía conserva `null`, sin
reemplazarla por el equipo habitual. `requester_id`, contexto de origen y
`requester_device_*` siguen perteneciendo al solicitante real.

El contrato anterior `area_devices`, la selección por área para usuarios
comunes y la entrada por `asset_uid` desde Activos permanecen compatibles.
No se reescriben asignaciones, datos maestros ni tickets anteriores.
Migración SQL no aplica: se usan columnas existentes, sin FK entre bases.
La publicación se puede repetir sin operaciones sobre datos.

## Verificación

- Core: `node --test server/test/ticket-equipment.test.js` (3 pruebas).
- Tickets backend: `npm test` (60 pruebas, incluidas 12 de los dos routers
  reales con identidad, Core y persistencia simulados); `npm run build`.
- Tickets frontend: `npm test` (3 pruebas); `npm run build` con typecheck.
- Core: sintaxis de archivos modificados, build Vite y `git diff --check`.
- Prueba Chromium de ambas pantallas: script y resultados en
  `../run/ticket-equipment-20261006/` desde el workspace.
- No se crean usuarios, tickets ni asignaciones de prueba en producción.

## Publicación, smoke y rollback

Orden: backend Core (expansión compatible), backend Tickets, frontend
Tickets y frontend Core. Se conservan las dependencias Docker existentes
usando las imágenes previas como base y copiando fuentes y builds
verificados; las fuentes previas en contenedores coinciden con HEAD antes
del cambio. No se reinstalan paquetes ni se cambia la base de datos.

Respaldo Docker previo al cambio:
`mrti-tickets-backend:before-equipment-20261006` y
`mrti-tickets-frontend:before-equipment-20261006`.

Publicado el 2026-10-06: las imágenes nuevas se construyeron a partir de esos
respaldos, copiando únicamente los `src/` y `dist/` ya verificados. Los
contenedores `backend` y `frontend` se recrearon sin tocar MySQL. Smoke por
Nginx: `/tickets/tickets/new` 200, `/tickets-api/api/health` 200 y el contexto
de Tickets sin sesión 401. Core quedó reiniciado y publicó su release
`20261006-150447-3f0fa35`; `/api/health` 200 y `ticket-context` sin sesión
401. La inspección de los contenedores confirmó el backend nuevo y el bundle
del selector administrativo. No se crearon usuarios, tickets ni asignaciones.

Para volver a las imágenes previas, desde MRTI-Tickets:

```bash
docker tag mrti-tickets-backend:before-equipment-20261006 mrti-tickets-backend:latest
docker tag mrti-tickets-frontend:before-equipment-20261006 mrti-tickets-frontend:latest
docker compose up -d --no-build --no-deps --force-recreate backend frontend
```

En Core, promover `20261006-145311-8a74a68` con `npm run release:promote --`
seguido del ID. Revertir el commit de esta función y reiniciar sólo
`mrti-core-api` si también se desea retirar la expansión del contexto.
Las referencias de tickets ya creados continúan en las columnas existentes;
no requieren borrarse ni migrarse al revertir. No hacer push.
