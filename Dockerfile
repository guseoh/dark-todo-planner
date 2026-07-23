FROM node:22-alpine AS builder

WORKDIR /app
ENV DATABASE_URL=file:../data/prod.db

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
RUN npm run db:generate

COPY . .
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATABASE_URL=file:../data/prod.db

COPY package*.json ./
COPY prisma ./prisma
COPY scripts ./scripts
RUN npm ci --omit=dev
RUN npm run db:generate
RUN mkdir -p /app/data /app/backups && chown -R node:node /app/data /app/backups

COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/server/dist ./server/dist

EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["sh", "-c", "npm run db:deploy && exec npm run start"]
