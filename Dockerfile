# ---------- build stage ----------
FROM node:20-slim AS build
WORKDIR /app

# System deps for native modules & prisma in build
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    python3 make g++ openssl ca-certificates git \
    && rm -rf /var/lib/apt/lists/*

# Install deps
COPY package*.json ./
RUN npm ci

# Copy source (including prisma) and build
COPY . .
# Generate Prisma client (safe even if not used during build)
RUN npx prisma generate || true
RUN npm run build

# ---------- runtime stage ----------
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

# Minimal runtime deps + init, add non-root user
RUN apt-get update -y && apt-get install -y --no-install-recommends dumb-init openssl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -ms /bin/bash nodeuser

# Copy package files for reference
COPY package*.json ./

# Copy all node_modules from build stage (already includes prod deps)
COPY --from=build /app/node_modules ./node_modules

# Built app
COPY --from=build /app/dist ./dist

# Optional entrypoint to run prisma generate/migrate on start (see below)
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && chown -R nodeuser:nodeuser /app
USER nodeuser

EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["/entrypoint.sh"]
