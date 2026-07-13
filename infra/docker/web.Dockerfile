FROM node:22.23.1-alpine AS build
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@11.11.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @kagura/web build

FROM node:22.23.1-alpine AS runtime
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /workspace/apps/web/.next/standalone/ ./
COPY --from=build --chown=node:node /workspace/apps/web/.next/static/ ./apps/web/.next/static/
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=6 CMD node -e "fetch('http://127.0.0.1:3000/api/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
