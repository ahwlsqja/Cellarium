# Stage 1: Build
FROM node:22-slim AS builder
WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable

# Copy dependency files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm run build

# Stage 2: Production
FROM node:22-slim
WORKDIR /app

# Copy compiled output and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .

# Create data directory for last-block.json persistence
RUN mkdir -p /app/data

# Railway sets PORT automatically
EXPOSE 3000

CMD ["node", "dist/main.js"]
