# ==========================================
# Flowdesk CRM - Production Server Dockerfile
# ==========================================

FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Runtime image
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

# Create non-root user for security
USER node

EXPOSE 5000

CMD ["node", "dist/index.js"]
