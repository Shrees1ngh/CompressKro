// ============================================================
// CompressKro Backend — Image Controller v3.0
// Pure request/response handling. Business logic in image.service.
// ============================================================

const { compressImage, convertFormat, analyzeImageMetadata } = require('../services/image.service');

const MIME_TYPES = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  heif: 'image/heif',
  heic: 'image/heic',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  gif: 'image/gif',
  pdf: 'application/pdf'
};

function getMimeType(format) {
  return MIME_TYPES[format.toLowerCase()] || 'image/jpeg';
}

async function handleCompressImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const targetSizeKB = req.body.targetSizeKB ? parseInt(req.body.targetSizeKB) : null;
    const quality = req.body.quality ? parseInt(req.body.quality) : 82;
    const requestedFormat = req.body.format || null; // Force output format if specified
    const scalePercent = req.body.scalePercent ? parseInt(req.body.scalePercent) : null;

    const result = await compressImage(req.file.buffer, targetSizeKB, quality, requestedFormat, scalePercent);

    res.set({
      'Content-Type': getMimeType(result.format),
      'Content-Disposition': `attachment; filename="optimized_${req.file.originalname}"`,
      'Content-Length': result.buffer.length,
      // Custom headers exposed for the frontend client
      'x-compressed-width': result.width.toString(),
      'x-compressed-height': result.height.toString(),
      'x-quality-used': result.qualityUsed.toString(),
      'x-dimensions-reduced': result.dimensionsReduced ? 'true' : 'false',
      'x-compressed-format': result.format,
      'x-psnr': (result.psnr || 0).toString(),
      'x-visual-quality-score': (result.visualQualityScore || 90).toString(),
      'Access-Control-Expose-Headers': 'x-compressed-width, x-compressed-height, x-quality-used, x-dimensions-reduced, x-compressed-format, x-psnr, x-visual-quality-score'
    });

    res.send(result.buffer);
  } catch (err) {
    next(err);
  }
}

async function handleConvertHeic(req, res, next) {
  // Retained for compatibility with existing clients
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No HEIC file provided' });
    }

    const quality = req.body.quality ? parseInt(req.body.quality) : 90;
    const result = await convertFormat(req.file.buffer, 'jpeg', quality);

    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Disposition': 'attachment; filename="converted.jpg"',
      'Content-Length': result.buffer.length,
    });
    res.send(result.buffer);
  } catch (err) {
    next(err);
  }
}

async function handleConvertImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const targetFormat = req.body.targetFormat || 'jpeg';
    const quality = req.body.quality ? parseInt(req.body.quality) : 90;

    const result = await convertFormat(req.file.buffer, targetFormat, quality);

    res.set({
      'Content-Type': getMimeType(result.format),
      'Content-Disposition': `attachment; filename="converted.${result.format}"`,
      'Content-Length': result.buffer.length,
    });
    res.send(result.buffer);
  } catch (err) {
    next(err);
  }
}

async function handleAnalyzeImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const analysis = await analyzeImageMetadata(req.file.buffer);
    res.json(analysis);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  handleCompressImage,
  handleConvertHeic,
  handleConvertImage,
  handleAnalyzeImage
};
