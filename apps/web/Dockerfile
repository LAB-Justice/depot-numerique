FROM node:24-bookworm-slim AS build

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV LEFTHOOK=0

WORKDIR /workspace

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable
RUN git init -q

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY patches patches

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter web build

FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime

COPY apps/web/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/web/dist/web/browser /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:8080/ || exit 1
