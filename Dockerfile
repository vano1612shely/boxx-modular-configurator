# syntax=docker/dockerfile:1

# Built in CI, never on the server: `pnpm build` asks for 8 GB of heap and the
# VPS has 3.8 GB of RAM in total.

FROM node:22-bookworm-slim AS base
RUN npm install -g pnpm@11.1.3
WORKDIR /app

# pnpm-workspace.yaml carries `allowBuilds`, which is what lets sharp compile its
# native binding. Without it sharp installs and then fails at the first upload.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
# Payload reads the connection string when the config is imported, so the build
# needs one present. It is never connected to.
ENV DATABASE_URL=postgres://build:build@127.0.0.1:5432/build
ENV PAYLOAD_SECRET=build-only
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/.next ./.next
# /favicon.svg is asked for by both the configurator's layout and the admin
# panel's own meta. Without this the runner has no public/ and both 404.
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/src ./src

# The upload adapter writes relative to the working directory, so these are the
# paths the bind mounts have to land on. Created here so the container still
# starts if a mount is missing.
#
# Only what the app writes to is given away. `chown -R /app` rewrites every
# file's metadata, and overlayfs records that as a second full copy of
# node_modules — a 1.15 GB layer that, being last, changed on every commit and
# was re-pulled on every deploy. Everything else is world-readable already.
RUN mkdir -p models textures images media .next/cache \
 && chown node:node models textures images media \
 && chown -R node:node .next/cache

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/access').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["pnpm", "start"]
