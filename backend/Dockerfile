# ============================================================
# CompressKro Backend — Production Dockerfile
# Base: Debian Bookworm Slim for maximum Sharp & Ghostscript stability
# ============================================================

FROM node:20-bookworm-slim

# Install system dependencies (including python3-venv for virtual environment)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ghostscript \
    qpdf \
    tesseract-ocr \
    tesseract-ocr-eng \
    python3 \
    python3-pip \
    python3-venv \
    ocrmypdf \
    poppler-utils \
    unpaper \
    pngquant \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory inside container
WORKDIR /app

# ── rembg setup via isolated virtual environment ──────────────
# Using a venv guarantees the node user can always find and run
# rembg regardless of Debian's system-python path quirks.

# Create virtual environment at a fixed, known path
RUN python3 -m venv /opt/rembg-env

# Install rembg and onnxruntime inside the venv
RUN /opt/rembg-env/bin/pip install --no-cache-dir "rembg[cpu]" onnxruntime

# Verification — fail the Docker build immediately if rembg is missing
RUN /opt/rembg-env/bin/python -c "import rembg; print('rembg OK:', rembg.__file__)"

# Pre-download AI segmentation models at build time (avoids runtime download)
ENV U2NET_HOME=/app/.u2net
RUN /opt/rembg-env/bin/python -c "from rembg import new_session; new_session('isnet-general-use'); new_session('u2netp')"

# Grant node user read/execute access to venv and model cache
RUN chmod -R a+rX /opt/rembg-env && \
    chown -R node:node /app/.u2net

# ── Node.js application setup ────────────────────────────────

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
