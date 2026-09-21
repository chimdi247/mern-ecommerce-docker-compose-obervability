# ============================================
# Dependencies stage (cached separately from source changes)
# ============================================
FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ============================================
# Build stage
# ============================================
FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY . .
RUN npm run build

# ============================================
# Production dependencies only
# ============================================
FROM node:22-alpine AS prod-deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ============================================
# Runtime stage
# ============================================
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./package.json

EXPOSE 5000
EXPOSE 9464

# Zero-code OpenTelemetry auto-instrumentation: --require loads
# src/otel/otel-bootstrap.ts (compiled to dist/otel/otel-bootstrap.js)
# before any application code runs. See that file and
# observability/README.md for details -- it's defensive (wrapped in
# try/catch) so a telemetry failure can never prevent the app itself
# from starting.
CMD ["node", "--require", "./dist/otel/otel-bootstrap.js", "dist/server.js"]
