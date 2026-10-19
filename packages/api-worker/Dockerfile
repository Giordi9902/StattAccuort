# API image. Built from the repository root (see compose.yaml): it also needs packages/cities.
FROM oven/bun:1-alpine AS deps
WORKDIR /app/packages/api-worker
COPY packages/api-worker/package.json packages/api-worker/bun.lock ./
RUN bun install --frozen-lockfile

FROM node:24-alpine
# `unzip` unpacks the GTFS feed for the seed refresh and the timetable import.
RUN apk add --no-cache unzip
WORKDIR /app/packages/api-worker
COPY packages/cities /app/packages/cities
COPY --from=deps /app/packages/api-worker/node_modules ./node_modules
COPY packages/api-worker/ ./
ENV NODE_ENV=production PORT=8787 HOST=0.0.0.0
EXPOSE 8787
ENTRYPOINT ["/app/packages/api-worker/docker/entrypoint.sh"]
CMD ["serve"]
