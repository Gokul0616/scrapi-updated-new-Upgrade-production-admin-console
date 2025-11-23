FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    mongodb-tools \
    redis

# Create app directory
WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --production

# Copy application code
COPY . .

# Create backup directory
RUN mkdir -p /app/backups

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8001/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "server.js"]
