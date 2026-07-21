// ============================================================
// CompressKro Backend — PDF Controller v2.0
// Coordinates request/response routing with PDF service outputs.
// ============================================================

const { compressPdf } = require('../services/pdf.service');

async function handleCompressPdf(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file provided' });
    }

    const level = req.body.level || 'balanced';
    const targetSizeKB = req.body.targetSizeKB ? parseInt(req.body.targetSizeKB) : null;

    const result = await compressPdf(req.file.buffer, level, targetSizeKB);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="compressed_${req.file.originalname}"`,
      'Content-Length': result.buffer.length,
      // Expose headers for PDF metrics analysis on client
      'Access-Control-Expose-Headers': 'x-original-size, x-compressed-size, x-saved-percent, x-pages, x-images-optimized, x-fonts-preserved, x-compression-time',
      'x-original-size': result.report.originalSize.toString(),
      'x-compressed-size': result.report.compressedSize.toString(),
      'x-saved-percent': result.report.savedPercent.toString(),
      'x-pages': result.report.pages.toString(),
      'x-images-optimized': result.report.imagesOptimized.toString(),
      'x-fonts-preserved': result.report.fontsPreserved.toString(),
      'x-compression-time': result.report.compressionTime.toString()
    });

    res.send(Buffer.from(result.buffer));
  } catch (err) {
    next(err);
  }
}

module.exports = { handleCompressPdf };
