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

# Install rembg globally as root
RUN pip3 install --no-cache-dir --break-system-packages "rembg[cpu]" onnxruntime

# Print where pip installed rembg (for debugging future builds)
RUN python3 -c "import rembg; print('rembg OK:', rembg.__file__)" && \
    python3 -c "import sys; print('sys.path:', sys.path)"

# Set PYTHONPATH so that ALL users (including node) can import pip-installed packages.
# This is the core fix: Debian Bookworm's python3 may exclude /usr/local/lib paths
# from sys.path for non-root users. Setting PYTHONPATH overrides that behavior.
ENV PYTHONPATH="/usr/local/lib/python3.11/dist-packages:/usr/lib/python3/dist-packages"

# Verify rembg is importable with PYTHONPATH set (simulates runtime conditions)
RUN python3 -c "import rembg; print('rembg with PYTHONPATH OK:', rembg.__file__)"

# Pre-download the lightweight u2netp model at build time
ENV U2NET_HOME=/app/.u2net
RUN python3 -c "from rembg import new_session; new_session('u2netp'); print('u2netp model cached OK')"

# Grant node user access to the model cache
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
