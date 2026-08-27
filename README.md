# MRTI-Tickets

Módulo de tickets de soporte técnico para la plataforma MRTI.

## Arquitectura

- `backend/`: API REST en Node.js + Express + TypeScript.
- `frontend/`: UI React + Vite + TypeScript.
- `migrations/`: migraciones SQL y seeds iniciales.
- `docker-compose.yml`: despliegue local con MySQL y backend.

## Requisitos

- Node.js 20+
- npm
- MySQL 8+

## Configuración

Copia el archivo de ejemplo del backend:

```bash
cd MRTI-Tickets/backend
cp .env.example .env
```

Ajusta:

- `DATABASE_*`
- `CORE_API_URL`
- `MRTI_INFRA_API_URL`
- `AGENT_API_KEY`
- `CORE_NOTIFICATION_URL`
- `CORE_INTROSPECT_URL`

## Ejecutar local

### Backend

```bash
cd MRTI-Tickets/backend
npm install
npm run migrate
npm run dev
```

### Frontend

```bash
cd MRTI-Tickets/frontend
npm install
npm run dev
```

## Ejecutar con Docker

```bash
cd MRTI-Tickets
docker compose up --build
```

En el servidor MRTI, Nginx publica el frontend en `/tickets/` y la API bajo
`/tickets-api/`. Tickets reutiliza las cuentas y sesiones de MRTI Core.
Los adjuntos y la base de datos se conservan en volúmenes Docker.

## Migraciones

```bash
cd MRTI-Tickets/backend
npm run migrate
```

La migración `002_user_uuid_support.sql` adapta los identificadores de usuario
al UUID estable que ahora administra MRTI Core y crea las políticas SLA iniciales.

## Endpoints principales

- `GET /api/health`
- `GET /api/tickets`
- `POST /api/tickets`
- `GET /api/tickets/:id`
- `PATCH /api/tickets/:id/status`
- `POST /api/tickets/:id/comments`
- `POST /api/tickets/:id/attachments`
- `GET /api/tickets/:id/history`
- `POST /api/agent/events`
- `GET /api/dashboard/summary`
- `GET /api/reports/tickets`
- `GET /api/sla/policies`
- `GET /api/tickets/:id/sla-status`

## Integraciones

### Core

- Autenticación de usuarios con token JWT o introspección.
- Notificaciones a través de `CORE_NOTIFICATION_URL`.

### MRTI Infra

- Consulta de datos de equipos mediante `MRTI_INFRA_API_URL`.

### MRTI-Agent

- Ingesta de eventos en `POST /api/agent/events`.
- Correlación de eventos por `device_id + event_type + component`.

## Operación empresarial

- El centro operativo muestra trabajo activo, edad de la cola, cumplimiento y
  riesgo SLA, demanda por área, carga por responsable y trabajo recomendado.
- La bandeja ofrece colas compatibles por URL: `scope=open`, `mine`,
  `unassigned`, `overdue` y `at-risk`; admite filtros, orden y paginación.
- Cada fila expone prioridad, responsable, actividad y estado SLA. La ficha del
  ticket muestra tiempo consumido, restante y fecha de compromiso.
- Los indicadores se calculan en tiempo real desde Tickets; usuarios continúan
  siendo propiedad de Core y ubicación/equipo se consultan mediante sus APIs.

## Seguridad y clasificación por área

- Cada solicitud requiere un destino `Área → Categoría → Detalle`; las
  categorías y detalles se validan en el backend para impedir combinaciones
  manipuladas desde el navegador.
- El área queda guardada directamente en el ticket. Los integrantes sólo ven,
  comentan, asignan y cambian el estado de tickets pertenecientes a sus áreas.
- Los administradores globales conservan visibilidad completa para configurar,
  auditar y recuperar la operación.
- En **Equipos por área**, un administrador asigna usuarios de Core con acceso
  al módulo Tickets a TI, Compras, Pagos o RH. Un área sin integrantes sólo es
  visible para administradores globales.
- El autoservicio de Core conserva acceso a las solicitudes propias sin otorgar
  acceso al módulo operativo.

## Datos semilla

Se cargan en `migrations/seed_data.sql`:

- Estados
- Prioridades
- Categorías básicas

## Pruebas y calidad

- Backend: `npm run lint`, `npm run build`, `npm test`
- Frontend: `npm run lint`, `npm run build`, `npm test`

## Ejecución de pruebas

- Backend: `cd MRTI-Tickets/backend && npm test`
- Frontend: `cd MRTI-Tickets/frontend && npm test`

## Notas

- El almacenamiento de archivos es local por defecto.
- La lógica de SLA es básica y puede extenderse con calendarios laborales.
