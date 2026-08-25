# syntax=docker/dockerfile:1

FROM node:20-slim AS base
WORKDIR /repo
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm install --workspaces --include-workspace-root

FROM deps AS build
COPY . .
RUN npm run build:shared
RUN npm run --workspace=apps/backend prisma:generate
RUN npm run build:backend

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/packages/shared/dist ./packages/shared/dist
COPY --from=build /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /repo/apps/backend/dist ./apps/backend/dist
COPY --from=build /repo/apps/backend/package.json ./apps/backend/package.json
COPY --from=build /repo/apps/backend/prisma ./apps/backend/prisma
COPY --from=build /repo/node_modules/.prisma ./node_modules/.prisma

EXPOSE 4000
WORKDIR /repo/apps/backend
CMD ["node", "dist/server.js"]
