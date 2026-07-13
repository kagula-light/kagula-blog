FROM node:22.23.1-alpine AS build
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@11.11.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @kagura/worker build

FROM node:22.23.1-alpine AS runtime
ENV NODE_ENV=production WORKER_HEALTH_PORT=3001
WORKDIR /app
COPY --from=build --chown=node:node /workspace/apps/worker/dist/ ./dist/
COPY --from=build --chown=node:node /workspace/packages/database/drizzle/ ./drizzle/
USER node
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --retries=6 CMD node -e "fetch('http://127.0.0.1:3001/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
