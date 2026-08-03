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
`/tickets-api/`. Tickets reutiliza las cuentas y sesiones de MRTI Infra.
Los adjuntos y la base de datos se conservan en volúmenes Docker.

## Migraciones

```bash
cd MRTI-Tickets/backend
npm run migrate
```

La migración `002_user_uuid_support.sql` adapta los identificadores de usuario
al formato UUID utilizado por MRTI Infra y crea las políticas SLA iniciales.

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
