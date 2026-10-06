# Operación de tickets

## Flujo permitido

Los tickets se mueven de forma controlada para que el historial sea útil al
operar, medir SLA y explicar una resolución.

| Estado actual | Siguientes estados |
| --- | --- |
| Nuevo / Abierto | Asignado, En diagnóstico, En progreso, En espera, Cancelado |
| Asignado | En diagnóstico, En progreso, En espera, Cancelado |
| En diagnóstico / En progreso | Asignado, En diagnóstico, En progreso, En espera, Resuelto, Cancelado |
| En espera de usuario / proveedor | Asignado, En diagnóstico, En progreso, Resuelto, Cancelado |
| Resuelto | Cerrado, Reabierto |
| Reabierto | Asignado, En diagnóstico, En progreso, En espera, Resuelto, Cancelado |
| Cerrado / Cancelado | No tiene transiciones |

En espera, resuelto, cerrado, cancelado y reabierto requieren un motivo. Un
ticket debe tener responsable antes de resolverlo o cerrarlo. Cada transición
se guarda en el historial y en la auditoría.

## Adjuntos

El portal acepta JPG, PNG, PDF, TXT, DOCX, XLSX y ZIP de hasta 10 MB. Antes de
guardarlos se valida extensión, tipo declarado y firma del contenido cuando el
formato la tiene. Los archivos se almacenan con permisos sólo para el proceso
del servicio y se descargan como adjuntos sin interpretar el nombre enviado por
el navegador.

## Reversión

Esta entrega no cambia el esquema ni elimina información. Para revertirla se
restaura la imagen anterior de `mrti-tickets-backend` y
`mrti-tickets-frontend`; los tickets, comentarios, adjuntos e historial creados
durante el periodo se conservan porque el cambio sólo valida operaciones nuevas.
