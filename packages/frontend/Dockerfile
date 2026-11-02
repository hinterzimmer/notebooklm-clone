FROM node:24-slim AS builder

WORKDIR /app

COPY package*.json tsconfig.base.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/backend/package*.json ./packages/backend/
COPY packages/frontend/package*.json ./packages/frontend/

RUN npm install

COPY packages/shared/ ./packages/shared/
COPY packages/frontend/ ./packages/frontend/

RUN npm run build --workspace=@notebooklm/shared
RUN npm run build --workspace=@notebooklm/frontend

FROM node:24-slim

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/packages/frontend/dist ./dist

EXPOSE 5173

CMD ["serve", "-s", "dist", "-l", "5173"]
