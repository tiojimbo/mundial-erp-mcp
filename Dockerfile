FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --ignore-scripts

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 mcp && adduser --system --uid 1001 mcp
COPY --from=build /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
USER mcp
EXPOSE 3120
HEALTHCHECK --interval=30s --timeout=5s CMD wget --spider http://localhost:3120/health || exit 1
CMD ["node", "dist/index.js"]
