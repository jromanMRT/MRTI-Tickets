FROM node:20-alpine AS build
WORKDIR /app
COPY --chown=node:node package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts ./
USER node
RUN npm ci --ignore-scripts
COPY --chown=node:node . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:alpine
ARG VERSION=unknown
ARG REVISION=unknown
ARG CREATED=unknown
ARG SOURCE=unknown
LABEL org.opencontainers.image.title="MRTI Tickets Frontend" \
      org.opencontainers.image.version="$VERSION" \
      org.opencontainers.image.revision="$REVISION" \
      org.opencontainers.image.created="$CREATED" \
      org.opencontainers.image.source="$SOURCE"
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
