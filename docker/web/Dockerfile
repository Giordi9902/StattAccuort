# Web entry point: the built frontend, the basemap files and a reverse proxy to the API, on one
# origin. Built from the repository root (see compose.yaml).
FROM oven/bun:1-alpine AS build
WORKDIR /app/packages/frontend-next
COPY packages/frontend-next/package.json packages/frontend-next/bun.lock ./
RUN bun install --frozen-lockfile
COPY packages/cities /app/packages/cities
COPY packages/frontend-next/ ./
# The bundle needs absolute URLs, baked in at build time; they override .env.production.
ARG PUBLIC_URL=http://localhost:8080
ENV VITE_API_URL=${PUBLIC_URL}/api VITE_TILES_BASE_URL=${PUBLIC_URL}/tiles
RUN bun run build

FROM caddy:2-alpine
COPY docker/web/Caddyfile /etc/caddy/Caddyfile
COPY docker/web/start.sh /start.sh
COPY --from=build /app/packages/frontend-next/dist /srv/app
CMD ["/start.sh"]
