FROM node:24-bookworm-slim AS build

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV LEFTHOOK=0

WORKDIR /workspace

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git openssl \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable
RUN git init -q

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/database/package.json packages/database/package.json
COPY patches patches

RUN pnpm install --frozen-lockfile

COPY . .

RUN DATABASE_URL=postgresql://docker-build:docker-build@localhost:5432/docker-build \
  pnpm --filter @depot-numerique/database build \
  && pnpm --filter api build \
  && pnpm deploy --legacy --filter api --prod /prod

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV API_PORT=3000

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /prod ./
COPY --from=build /workspace/apps/api/dist ./dist

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]
