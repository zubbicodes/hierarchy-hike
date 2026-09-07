# syntax=docker/dockerfile:1.7

# ---------------------------------------------------------------------------
# hierarchy-hike — TanStack Start (SSR, Nitro) production image
#
# Targets:
#   app  -> Node runtime serving the Nitro SSR server on $PORT (default 3000)
#   web  -> nginx serving static assets + reverse-proxying to the app service
#
# Build a single target explicitly:
#   docker build --target app -t hierarchy-hike-app .
#   docker build --target web -t hierarchy-hike-web .
# ---------------------------------------------------------------------------

ARG BUN_VERSION=1.2
ARG NODE_VERSION=22


# --- 1. dependencies -------------------------------------------------------
FROM oven/bun:${BUN_VERSION}-alpine AS deps
WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile


# --- 2. build --------------------------------------------------------------
FROM oven/bun:${BUN_VERSION}-alpine AS build
WORKDIR /app

# Nitro defaults to the cloudflare preset in this project's vite config.
# Force the plain Node server output so it can run on a VPS.
ENV NITRO_PRESET=node-server \
    SERVER_PRESET=node-server \
    NODE_ENV=production

# VITE_* values are inlined at build time, so they must be build args.
# Add one ARG/ENV pair per public variable the app reads.
ARG VITE_API_URL=""
ARG VITE_MAP_TOKEN=""
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_MAP_TOKEN=${VITE_MAP_TOKEN}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN bun run build \
 && test -f .output/server/index.mjs \
      || (echo "ERROR: .output/server/index.mjs missing — Nitro did not use the node-server preset. Check NITRO_PRESET." && ls -R .output | head -50 && exit 1)


# --- 3. app runtime (SSR server) -------------------------------------------
FROM node:${NODE_VERSION}-alpine AS app
WORKDIR /app

RUN apk add --no-cache wget tini \
 && addgroup -g 1001 -S nodejs \
 && adduser  -u 1001 -S nodejs -G nodejs

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

COPY --from=build --chown=nodejs:nodejs /app/.output ./.output

USER nodejs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/" >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", ".output/server/index.mjs"]


# --- 4. web runtime (nginx edge) -------------------------------------------
FROM nginx:1.27-alpine AS web

RUN apk add --no-cache wget \
 && rm -f /etc/nginx/conf.d/default.conf

# Static client assets are served straight off disk; everything else proxies
# to the `app` service over the compose network.
COPY --from=build /app/.output/public /usr/share/nginx/html
COPY nginx/nginx.conf             /etc/nginx/nginx.conf
COPY nginx/default.conf           /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf  /etc/nginx/snippets/security-headers.conf

RUN nginx -t -c /etc/nginx/nginx.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/nginx-health >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
