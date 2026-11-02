FROM node:24-slim AS builder

WORKDIR /app

COPY package*.json tsconfig.base.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/backend/package*.json ./packages/backend/
COPY packages/frontend/package*.json ./packages/frontend/

RUN npm install

COPY packages/shared/ ./packages/shared/
COPY packages/backend/ ./packages/backend/

RUN npm run build --workspace=@notebooklm/shared
RUN npm run build --workspace=@notebooklm/backend

FROM node:24-slim

WORKDIR /app

ENV NODE_ENV=production
ENV APP_MODE=ALL
ENV PORT=3000

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/backend/package*.json ./packages/backend/

RUN npm install --omit=dev

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist

EXPOSE 3000

CMD ["node", "packages/backend/dist/main.js"]
