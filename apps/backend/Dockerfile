FROM node:22-alpine AS deps

WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/package.json
RUN pnpm install --frozen-lockfile --filter backend...

FROM deps AS builder
COPY apps/backend ./apps/backend
WORKDIR /app/apps/backend
RUN pnpm build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/package.json
RUN pnpm install --prod --frozen-lockfile --filter backend...

COPY --from=builder /app/apps/backend/dist ./apps/backend/dist

WORKDIR /app/apps/backend
EXPOSE 3001
CMD ["pnpm", "start"]
