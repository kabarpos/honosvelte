# Multi-stage: build assets in stage 1, minimal runtime in stage 2.
FROM oven/bun:1.3-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1.3-alpine
WORKDIR /app
ENV NODE_ENV=production
# Runtime runs as a non-root user (OPS-01). Data directories are created and
# chowned here so named volumes inherit writable permissions; bind mounts
# must be owned by UID 1000 on the host (see docker-compose.yml).
RUN addgroup -S app && adduser -S app -G app \
  && mkdir -p /app/data/uploads /app/data/media \
  && chown -R app:app /app/data
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=build /app/dist ./dist
COPY src ./src
COPY migrations ./migrations
COPY scripts ./scripts
USER app
EXPOSE 4000
# Healthcheck uses `bun` — guaranteed present in this image (no curl/wget
# dependency). /health/ready covers DB + storage writability.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["bun", "-e", "const r=await fetch('http://127.0.0.1:4000/health/ready');if(!r.ok)process.exit(1)"]
# bun runs TS directly; dist/assets are prebuilt in the build stage.
CMD ["bun", "run", "src/index.ts"]
