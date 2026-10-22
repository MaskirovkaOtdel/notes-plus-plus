# Notes++ — single-image build (API + web assets on one port).
#
# Stage 1 (build): full workspace install, `pnpm build` (packages compile to
# dist, API tsc, web vite build incl. service worker), then `pnpm deploy` of
# the API with production dependencies only — workspace packages travel as
# packed artifacts (their `files` field), which is exactly the pack-ability
# the packaging workstream established.
#
# Stage 2 (runtime): node:24-alpine, non-root user, serves the API and the
# built web app (WEB_DIST) from one process.

FROM node:24-alpine AS build
WORKDIR /app

# Deterministic pnpm matching the root `packageManager` field.
RUN npm install -g pnpm@12.11.2

# Playwright browsers are a dev-time artifact; never download them in images.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Manifests first so dependency layers cache across source changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY e2e/package.json e2e/
COPY packages/shared/package.json packages/shared/
COPY packages/markdown/package.json packages/markdown/
COPY packages/ui/package.json packages/ui/
COPY packages/ext-word-count/package.json packages/ext-word-count/
RUN pnpm install --frozen-lockfile

COPY . .

# Baked into the web bundle at build time. VITE_API_TOKEN must match the
# server's NOTESPP_API_TOKEN runtime env when auth is enabled.
ARG APP_VERSION=0.0.0-docker
ENV APP_VERSION=${APP_VERSION}
ARG VITE_API_TOKEN=""
ENV VITE_API_TOKEN=${VITE_API_TOKEN}

RUN pnpm build
RUN pnpm --filter "@notespp/api" deploy --legacy --prod /deploy

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4000 \
    WEB_DIST=/app/web-dist

COPY --from=build --chown=node:node /deploy ./
COPY --from=build --chown=node:node /app/apps/web/dist ./web-dist

USER node
EXPOSE 4000

# /health stays unauthenticated by design (container probes).
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1

CMD ["node", "dist/server.js"]
