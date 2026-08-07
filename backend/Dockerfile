# ============================================================
# CompressKro Backend — Production Dockerfile
# Base: Debian Bookworm Slim for maximum Sharp & Ghostscript stability
# ============================================================

FROM node:20-bookworm-slim

# Install system dependencies (including chromium for Puppeteer)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ghostscript \
    qpdf \
    tesseract-ocr \
    tesseract-ocr-eng \
    python3 \
    python3-pip \
    ocrmypdf \
    poppler-utils \
    unpaper \
    pngquant \
    curl \
    chromium \
    && rm -rf /var/lib/apt/lists/*

# Set working directory inside container
WORKDIR /app


# Copy dependency manifests with node ownership for fast caching
COPY --chown=node:node package.json package-lock.json* ./

# Tell Puppeteer to skip downloading bundled Chromium (we use system chromium)
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Install production dependencies
RUN npm install --omit=dev

# Copy application source code with node ownership
COPY --chown=node:node . .

# Create tmp directories for runtime file processing (before switching to node user)
RUN mkdir -p /app/tmp/uploads /app/tmp/outputs && chown -R node:node /app/tmp

# Set environment variables
ENV NODE_ENV=production

# Run as non-root user
USER node

# Expose default backend port
EXPOSE 3001

# Healthcheck configuration using curl on the health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl --fail http://localhost:${PORT:-3001}/api/health || exit 1

# Launch the backend server
CMD ["node", "server.js"]
