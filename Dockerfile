# syntax=docker/dockerfile:1

# ---- Dependencies ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---- Builder ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* é embutido no bundle em build-time. Em teste local (docker-compose)
# passe "false" para não enviar hits reais ao Mautic; em produção deixe vazio (on).
ARG NEXT_PUBLIC_MAUTIC_TRACKING_ENABLED=
ENV NEXT_PUBLIC_MAUTIC_TRACKING_ENABLED=$NEXT_PUBLIC_MAUTIC_TRACKING_ENABLED
ARG NEXT_PUBLIC_SITE_URL=
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
# R2_PUBLIC_URL e R2_ACCOUNT_ID são lidos em next.config.ts (build-time) para
# computar images.remotePatterns e CSP. Não são NEXT_PUBLIC_* (não vazam pro client);
# apenas IDs/URLs públicos (sem segredos).
ARG R2_PUBLIC_URL=
ENV R2_PUBLIC_URL=$R2_PUBLIC_URL
ARG R2_ACCOUNT_ID=
ENV R2_ACCOUNT_ID=$R2_ACCOUNT_ID
RUN npm run build

# ---- Runner (standalone) ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
