// ============================================================
// CompressKro Backend — Main Entry Point
// Clean setup + listen. All business logic in routes/controllers/services.
// ============================================================

const express = require('express');
const cors = require('cors');

const { PORT, CORS_ORIGIN } = require('./config');
const imageRoutes = require('./routes/image.routes');
const pdfRoutes = require('./routes/pdf.routes');
const errorHandler = require('./middlewares/errorHandler');
const sharp = require('sharp');

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
