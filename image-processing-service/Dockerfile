# --- Stage 1: The "Builder" ---
FROM node:20-alpine AS builder

# Security updates
RUN apk update && apk upgrade

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install tsc-alias globally
RUN npm install -g tsc-alias

# Copy all source code
COPY . .

RUN echo "--- Checking if generated folder was copied ---" && ls -la src/shared/prisma/ || echo "prisma folder structure" && test ! -d src/shared/prisma/generated && echo "✓ Generated folder NOT copied (correct!)" || echo "✗ Generated folder WAS copied (dockerignore not working)"

# Install dependencies and generate Prisma client
RUN npm ci
RUN rm -rf test
RUN find . -name "*.spec.ts" -type f -delete
RUN find . -name "*.e2e-spec.ts" -type f -delete

# Force remove any Windows-generated Prisma client and generate fresh for Alpine
RUN rm -rf src/shared/prisma/generated && echo "Removed any existing generated folder"
RUN npm run generate
RUN echo "--- Verifying Alpine binary was generated ---" && ls -la src/shared/prisma/generated/ | head -20
RUN npm run build
RUN ls -la dist/ && echo "--- Checking for main.js ---" && ls -la dist/main.js || echo "main.js NOT FOUND"

# --- Stage 2: The Final Image ---
FROM node:20-alpine

# Security updates
RUN apk update && apk upgrade

WORKDIR /app

# Copy only production dependencies
COPY --from=builder /app/package*.json ./

# Copy Prisma schema first (needed for generate)
COPY --from=builder /app/src/shared/prisma/schema ./src/shared/prisma/schema

# Install production deps and generate Prisma client for Alpine
RUN npm ci --omit=dev
RUN npx prisma generate --schema=./src/shared/prisma/schema/schema.prisma

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy the rest of Prisma files
COPY --from=builder /app/src/shared/prisma/migrations ./src/shared/prisma/migrations

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/main.js"]