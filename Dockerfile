FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts --include=dev

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache curl && addgroup --system --gid 1001 mcp && adduser --system --uid 1001 mcp
COPY --from=build /app/dist ./dist
COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json ./
USER mcp
EXPOSE 3120
HEALTHCHECK --interval=30s --timeout=5s CMD wget --quiet --spider http://localhost:3120/health || exit 1
CMD ["node", "dist/index.js"]
