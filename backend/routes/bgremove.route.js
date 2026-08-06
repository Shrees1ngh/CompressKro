// ============================================================
// CompressKro Backend — Background Removal Routes
// ============================================================

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { removeBackground } = require('../services/bgremove.service');
const limitConcurrency = require('../middlewares/concurrencyLimiter');

const router = express.Router();

// Configure disk storage for Multer to store uploaded temp files in tmp/uploads/
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../tmp/uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

router.post('/remove-bg', upload.single('file'), limitConcurrency, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded' });
  }

  const inputPath = req.file.path;
  const outputFilename = `no_bg_${Date.now()}_${Math.round(Math.random() * 1E9)}.png`;
  const outputDir = path.join(__dirname, '../tmp/outputs');
  const outputPath = path.join(outputDir, outputFilename);

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const model = req.body.model || 'u2netp';

  try {
    // Process image background removal via rembg
    await removeBackground(inputPath, outputPath, model);

    // Send the compiled transparent PNG image file
    res.sendFile(outputPath, (err) => {
      // Clean up both temp files after response finishes
      try {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      } catch (cleanupErr) {
        console.error('[BgRemove Route] Post-sending cleanup failed:', cleanupErr.message);
      }

      if (err) {
        console.error('[BgRemove Route] Failed sending file:', err.message);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed sending generated background cutout.' });
        }
      }
    });
  } catch (err) {
    console.error('[BgRemove Route] Error during background removal:', err.message);
    
    // Safety cleanup in case of execution failure
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch (cleanupErr) {
      console.error('[BgRemove Route] Fail-safe cleanup failed:', cleanupErr.message);
    }
    
    res.status(500).json({ error: err.message || 'AI background removal processing failed' });
  }
});

module.exports = router;
