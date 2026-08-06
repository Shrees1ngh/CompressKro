// ============================================================
// CompressKro Backend — Main Entry Point
// Clean setup + listen. All business logic in routes/controllers/services.
// ============================================================

const express = require('express');
const cors = require('cors');

const { PORT, CORS_ORIGIN } = require('./config');
const imageRoutes = require('./routes/image.routes');
const pdfRoutes = require('./routes/pdf.routes');
const bgremoveRoutes = require('./routes/bgremove.route');
const errorHandler = require('./middlewares/errorHandler');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const { execFile } = require('child_process');

// Ensure tmp directories exist on boot
const uploadDir = path.join(__dirname, 'tmp/uploads');
const outputDir = path.join(__dirname, 'tmp/outputs');
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(outputDir, { recursive: true });

// Startup diagnostic: verify rembg is available (non-blocking)
if (process.platform !== 'win32') {
  const env = {
    ...process.env,
    PYTHONPATH: [
      '/usr/local/lib/python3.11/dist-packages',
      '/usr/local/lib/python3.12/dist-packages',
      '/usr/local/lib/python3.10/dist-packages',
      '/usr/lib/python3/dist-packages',
      process.env.PYTHONPATH
    ].filter(Boolean).join(':')
  };
  
  execFile('python3', ['-c', 'import rembg; print("STARTUP OK: rembg", rembg.__version__, "at", rembg.__file__)'], { env }, (err, stdout, stderr) => {
    if (err) {
      console.error('⚠️  STARTUP DIAGNOSTIC: rembg NOT available via python3');
      console.error('   Error:', stderr || err.message);
      execFile('python3', ['-c', 'import sys; print("sys.path:", sys.path)'], { env }, (e2, out2) => {
        if (out2) console.error('   python3 sys.path:', out2.trim());
      });
    } else {
      console.log('✅', stdout.trim());
    }
  });
}

// Tune sharp global cache & concurrency to leverage libvips native performance
sharp.cache({ memory: 50, files: 20, items: 100 });
sharp.concurrency(1);

const app = express();

// ── Middleware ──────────────────────────────────────────────
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '50mb' }));

// ── Health Check ────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'CompressKro backend is running',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ── Routes ──────────────────────────────────────────────────
app.use('/api', imageRoutes);
app.use('/api', pdfRoutes);
app.use('/api', bgremoveRoutes);

// ── Error Handler (must be last) ────────────────────────────
app.use(errorHandler);

// ── Start ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 CompressKro Backend v2 on http://localhost:${PORT}`);
  console.log(`   Health: GET  /api/health`);
  console.log(`   Compress Image: POST /api/compress-image`);
  console.log(`   Convert HEIC:   POST /api/convert-heic`);
  console.log(`   Compress PDF:   POST /api/compress-pdf\n`);
});
