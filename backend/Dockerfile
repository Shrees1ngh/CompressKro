# ============================================================
# CompressKro Backend — Production Dockerfile
# Base: Debian Bookworm Slim for maximum Sharp & Ghostscript stability
# ============================================================

FROM node:20-bookworm-slim

# Install system dependencies
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
    && rm -rf /var/lib/apt/lists/*

# Set working directory inside container
WORKDIR /app

# Set Environment variables for rembg cache
ENV U2NET_HOME=/app/.u2net

# Install Python packages globally under root context
RUN pip3 install --no-cache-dir --break-system-packages "rembg[cpu]" onnxruntime

# Verification step (fails the build if rembg didn't install successfully)
RUN python3 -c "import rembg; print('rembg OK:', rembg.__file__)"

# Pre-download models globally under root context
RUN python3 -c "from rembg import new_session; new_session('isnet-general-use'); new_session('u2netp')"

# Explicitly chown cache folder to node user
RUN chown -R node:node /app/.u2net

# Copy dependency manifests with node ownership for fast caching
COPY --chown=node:node package.json package-lock.json* ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy application source code with node ownership
COPY --chown=node:node . .

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
