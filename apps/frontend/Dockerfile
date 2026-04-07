FROM node:22-alpine AS deps

WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json apps/frontend/package.json
RUN pnpm install --frozen-lockfile --filter frontend...

FROM deps AS builder
COPY apps/frontend ./apps/frontend
WORKDIR /app/apps/frontend
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json apps/frontend/package.json
RUN pnpm install --prod --frozen-lockfile --filter frontend...

COPY --from=builder /app/apps/frontend/.next ./apps/frontend/.next
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public
COPY --from=builder /app/apps/frontend/package.json ./apps/frontend/package.json
COPY --from=builder /app/apps/frontend/next.config.ts ./apps/frontend/next.config.ts

WORKDIR /app/apps/frontend
EXPOSE 3000
CMD ["pnpm", "start"]
