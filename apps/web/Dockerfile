# Image for the standalone generation worker (`bun run worker`) — an always-on
# process that drains the generation_jobs queue. Build from the repository root
# so the monorepo lockfile and workspace packages are in context:
#
#   flyctl deploy . --config apps/web/fly.toml --dockerfile apps/web/Dockerfile
#
FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY apps ./apps
COPY packages ./packages
# --production drops devDependencies; --ignore-scripts skips Panda codegen (the
# worker imports only server modules, never the styled-system UI).
RUN bun install --frozen-lockfile --production --ignore-scripts

FROM oven/bun:1-alpine
WORKDIR /app
COPY --from=deps /app /app
USER bun
ENV NODE_ENV=production
WORKDIR /app/apps/web
CMD ["bun", "run", "worker"]
