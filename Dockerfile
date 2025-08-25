# syntax=docker/dockerfile:1
FROM node:20-slim

# Set environment
ENV NODE_ENV=production
WORKDIR /usr/src/app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production --no-audit --no-fund

# Copy source code
COPY ./src ./src

# Cloud Run requirements
EXPOSE 8080
ENV PORT=8080
ENV HOST=0.0.0.0

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start the application
CMD ["node", "src/index.js"]
