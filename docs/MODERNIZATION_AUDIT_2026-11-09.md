# Auditoría y plan de modernización de MRTI Tickets

Fecha: 2026-11-09

## Alcance y línea base

La auditoría cubrió el frontend React/Vite, el backend Express/TypeScript, las
migraciones MySQL, autenticación/autorización, SLA, adjuntos, auditoría,
conversaciones, base de conocimiento e integraciones con Core, Activos y
Monitor. No se reconstruirá el módulo ni se cambiarán contratos existentes de
forma incompatible.

Estado de verificación al cerrar la auditoría:

- Backend: 19 archivos de prueba, 80 pruebas aprobadas, ESLint y TypeScript
  correctos.
- Frontend: 4 archivos de prueba, 4 pruebas aprobadas, ESLint, typecheck y
  build correctos.
- `npm audit --omit=dev`: 0 vulnerabilidades conocidas en backend y frontend.
- La base publicada contiene 16 tickets, por lo que todavía no hay volumen
  suficiente para inferir tendencias operativas robustas ni justificar
  optimizaciones por intuición.
- El bundle publicado compila, pero Vite advierte dos chunks superiores a 500
  kB; conviene dividir rutas pesadas antes de que crezca el módulo.
- Se preservaron los cambios locales previos en `.eslintrc.cjs`,
  `data-table.tsx` y `TicketDetail.tsx`.

## Arquitectura y propiedad de datos

- Tickets es propietario de tickets, estados, categorías, comentarios,
  adjuntos, SLA, etiquetas, relaciones, equipos de atención y auditoría local.
- Core es propietario de identidad, UUID, sesión, catálogo de módulos y
  políticas de acceso. Tickets valida cada petición operativa con Core y guarda
  sólo referencias UUID estables.
- Activos es propietario del inventario. Tickets conserva `asset_uid` y valida
  o consulta mediante API; no copia el maestro ni crea FK cruzadas.
- Monitor/Agent es propietario de telemetría. Existe una entrada controlada de
  eventos con deduplicación por huella, pero el productor real y la entrega de
  notificaciones todavía no están cerrados como contrato operativo.
- Los datos de solicitante, ubicación y equipo son una captura contextual del
  momento de creación. Tickets no consulta ni expone información salarial,
  fiscal, médica o bancaria de RH.

## Matriz funcional

| Área | Estado actual | Evaluación | Brecha prioritaria |
|---|---|---|---|
| Dashboard | Totales reales, trabajo activo, SLA vencido/en riesgo, procesados en 7 días, promedio de resolución, carga por área/responsable y tendencias | Mejorable | Mostrar de forma directa los ocho indicadores solicitados, incluido resueltos hoy y críticos, sin inventar comparativas cuando la muestra sea insuficiente |
| Bandejas | Todos, activos, mis asignados, sin asignar, vencidos, en riesgo, en espera y escalados | Mejorable | Creados por mí, pendientes de respuesta diferenciados, críticos, resueltos, cerrados y vistas guardadas por usuario |
| Tabla | Paginación backend, búsqueda, filtros, ordenamiento, selección múltiple, densidad, redimensionamiento y CSV | Mejorable | Columnas visibles persistentes, categoría/departamento/ubicación explícitos y acciones contextuales con permisos visibles |
| Detalle | Panel lateral, conversación pública, notas internas, adjuntos, actividad, estado, asignación, SLA, etiquetas, relaciones, similares y KB sugerida | Casi completo | Cambio autorizado de prioridad/categoría, línea de tiempo unificada y ficha viva del activo con mínimo privilegio |
| Conversación | Solicitante y técnicos pueden responder; las notas privadas se filtran en servidor para autoservicio | Completo | Confirmación del solicitante al resolver y reapertura de autoservicio con reglas aprobadas |
| Flujo de estados | Transiciones permitidas, motivo obligatorio, asignado antes de resolver/cerrar, pausa SLA y auditoría | Completo básico | Aprobación de reglas de confirmación, reapertura y excepciones antes de automatizar |
| SLA de resolución | Política por prioridad/área/categoría, pausa, riesgo al 80 %, vencimiento y panel administrativo | Parcial | Primera respuesta real, horario laboral, festivos, calendario, eventos de incumplimiento y alertas deduplicadas |
| Asignación | Manual individual/masiva y validación de pertenencia al equipo del área | Parcial | Reglas configurables por categoría/ubicación/capacidad; no existe aún un modelo confiable de disponibilidad |
| Notificaciones | Campanilla central y novedades de tickets de equipo | Parcial | Entrega confiable por outbox, recordatorios y cambios importantes; el POST genérico actual no tiene consumidor válido |
| Monitor/Agent | Endpoint de eventos, prioridad por severidad y correlación para evitar duplicados | Parcial | Formalizar autenticación de servicio, productor real, esquema del evento y política de cierre/reapertura de correlaciones |
| Activos | Referencia `asset_uid`, validación contra Activos y búsqueda por historial capturado | Parcial | Tarjeta de activo consultada en vivo y acceso a incidencias históricas sin duplicar el maestro |
| Base de conocimiento | CRUD, publicación/borrador, búsqueda full-text, sugerencias y borrador al resolver | Mejorable | Revisión editorial y métricas de utilidad. La frontera de notas privadas se corrigió en esta fase |
| Reportes | Exportación CSV por rango y alcance de área | Básico | Métricas de primera respuesta, cumplimiento SLA, recurrencia, backlog y exportación paginada/asincrónica para volumen alto |
| Seguridad | Core auth, permiso por sección, alcance por área, queries parametrizadas, rate limit y validación binaria básica de adjuntos | Buena base | CORS explícito, consistencia archivo/DB, escaneo antimalware, límites específicos por endpoint y más pruebas negativas |
| Auditoría | Auditoría local general y eventos de negocio explícitos | Mejorable | Evitar eventos duplicados, conservar el mismo request-id de extremo a extremo y registrar resultado/estado de forma canónica |
| Rendimiento | Paginación en servidor e índices básicos | Adecuado al volumen actual | Búsquedas `%LIKE%`, subconsultas correlacionadas por fila y diez consultas del dashboard deben medirse antes de agregar índices compuestos o full-text |

## Hallazgos de riesgo

### Corregido en el primer incremento

El generador de borradores de conocimiento leía todos los comentarios del
ticket. Aunque el artículo nacía como borrador, una publicación posterior podía
exponer una nota interna. La consulta ahora exige `is_private = 0` en SQL y las
pruebas confirman que una nota interna nunca entra al cuerpo candidato.

### Pendientes

1. `first_response_minutes`, `work_hours` e `include_holidays` existen, pero el
   cálculo actual sólo utiliza `resolution_minutes` en tiempo corrido y pausas
   explícitas.
2. La integración `coreNotifications` documenta que su destino no acepta el
   POST usado; el fallo se ignora y no debe considerarse una notificación
   entregada.
3. El middleware de auditoría genera un request-id nuevo y varias rutas también
   escriben un evento explícito, provocando trazas duplicadas sin correlación
   persistente.
4. En adjuntos, un fallo de base posterior a guardar el archivo puede dejar un
   huérfano; al eliminar se borra primero el archivo y después la fila. Falta
   cuarentena/antimalware y una secuencia recuperable.
5. La búsqueda operativa usa comodines iniciales y los conteos de comentarios,
   adjuntos y etiquetas son subconsultas por fila. Con 16 tickets no es un
   problema medible; debe instrumentarse y probarse con volumen antes de
   cambiar índices.
6. La migración 013 produjo la columna e índice de `source_ticket_id`, pero no
   aparece en `schema_migrations`. La siguiente ejecución del runner la
   reconciliaría de forma idempotente, pero debe hacerse como cambio aprobado,
   verificado y con evidencia.
7. La cobertura del frontend es reducida: cuatro pruebas para dashboard,
   selector de equipo, bandeja y tema. Las operaciones del panel lateral y los
   permisos negativos necesitan pruebas propias.

## Arquitectura propuesta

La evolución debe conservar el monolito modular actual y agregar capacidades
por expansión:

1. API existente compatible; nuevos parámetros y rutas bajo
   `/api/tickets/workbench/*`.
2. Tablas nuevas sólo en `mrti_tickets`, con UUID de Core como referencia
   lógica y sin FK cruzadas.
3. Reglas y automatizaciones en estado `draft/disabled` por defecto.
4. Outbox local con clave de idempotencia para notificaciones y trabajos; un
   worker reintentable entrega a contratos reales y registra cada resultado.
5. Cálculo SLA en un único servicio compartido por listado, dashboard,
   notificaciones y detalle.
6. Integraciones consultadas en vivo con timeout y degradación controlada; la
   caída de otro módulo no debe bloquear la bandeja.

## Plan incremental priorizado

### Incremento 0 — Privacidad de conocimiento

Estado: completado en código, sin migración ni cambio de contrato.

- Filtrar notas internas al generar borradores.
- Cubrir inclusión pública, exclusión privada y caso sin contenido publicable.
- Criterio: pruebas, lint y build backend correctos.

### Incremento 1 — Productividad de bandeja

Impacto: alto. Complejidad: media. Riesgo: bajo-medio.

- Agregar scopes `created-by-me`, `awaiting-requester`, `critical`, `resolved`
  y `closed` sin retirar los actuales.
- Completar columnas y acciones según permiso.
- Crear vistas guardadas por UUID en una tabla aditiva `ticket_saved_views`
  con filtros/orden/columnas JSON, sin FK a Core.
- Añadir índices únicamente después de EXPLAIN y pruebas con datos de volumen.
- Requiere aprobación previa de la migración aditiva.

### Incremento 2 — SLA verificable

Impacto: alto. Complejidad: alta. Riesgo: medio.

- Definir con negocio qué constituye primera respuesta: primera respuesta
  pública de un técnico es la propuesta recomendada.
- Preparar calendarios, horarios y festivos como configuración inactiva hasta
  aprobación.
- Registrar primera respuesta, resolución e incumplimientos como eventos
  idempotentes.
- No recalcular históricos ni activar alertas automáticamente.
- Requiere aprobación de reglas y migraciones aditivas.

### Incremento 3 — Automatizaciones controladas

Impacto: alto. Complejidad: alta. Riesgo: medio-alto.

- Catálogo de reglas con prioridad, condiciones y acciones, deshabilitadas al
  crearse.
- Outbox con deduplicación para asignación, recordatorios, alertas y avisos.
- Vista previa/dry-run antes de activar una regla.
- Sin cierre automático ni escalamiento automático hasta autorización
  específica.

### Incremento 4 — Integraciones y analítica

Impacto: medio-alto. Complejidad: media-alta. Riesgo: medio.

- Activo vivo e historial por `asset_uid` mediante API.
- Contrato formal Monitor/Agent con huella estable y evidencia de entrega.
- Reportes SLA, backlog y recurrencia basados en eventos canónicos.
- IA sólo después de definir infraestructura, retención, clasificación de
  datos y autorización; nunca enviar notas internas a un proveedor externo por
  defecto.

## Decisiones requeridas antes del siguiente incremento con datos

1. Autorizar o no la migración aditiva de vistas guardadas.
2. Confirmar la definición de primera respuesta.
3. Proporcionar horario laboral y calendario de festivos aplicable por área.
4. Definir ventana y responsables para confirmación/reapertura del solicitante.

Cada incremento debe tener migración idempotente cuando aplique, pruebas,
smoke publicado, rollback documentado, commit independiente y actualización de
la guía Core/Infra. No se hará push ni se retirarán rutas o tablas sin
autorización explícita.
