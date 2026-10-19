# Release inmutable del frontend de Tickets

Estado: preparación de Fase 4. No ejecutar en producción sin registro OCI
privado, digest, ventana aprobada y respaldo del digest previo.

`docker-compose.release.yml` no contiene `build:` y acepta sólo
`MRTI_TICKETS_FRONTEND_IMAGE` fijada por `@sha256:`. Conserva
`127.0.0.1:4173`, publica `/tickets/`, expone `/healthz` y no declara backend,
MySQL, volúmenes ni dependencias: promover frontend no recrea esos servicios.

Construir una vez desde checkout limpio con los argumentos OCI `VERSION`,
`REVISION`, `CREATED` y `SOURCE`; registrar el digest, no sólo una etiqueta.
En puerto aislado comprobar `/tickets/`, su asset JS, `/healthz`,
`/tickets-api/api/health` y una respuesta 401 sin sesión. Guardar digest actual
y candidato. La promoción autorizada usa sólo:

```bash
docker compose -p mrti-tickets -f docker-compose.release.yml up -d --no-deps frontend
```

Rollback: restaurar el digest anterior y repetir el mismo comando sólo para
`frontend`; nunca reconstruir para volver atrás. Falta un registro OCI privado
con TLS, control de acceso, retención y respaldo, y un ensayo aprobado de
promote → smoke → rollback antes de sustituir el Compose actual.
