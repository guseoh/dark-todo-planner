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
ENV DATABASE_URL=file:../data/prod.db

COPY package*.json ./
COPY prisma ./prisma
COPY scripts ./scripts
RUN npm ci
RUN npm run db:generate

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server/dist ./server/dist

EXPOSE 3000
CMD ["sh", "-c", "npm run db:push && npm run start"]
