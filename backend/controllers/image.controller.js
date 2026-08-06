const { compressImage, convertFormat, analyzeImageMetadata } = require('../services/image.service');
const { convertHtmlToImage } = require('../services/html.service');

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

async function handleHtmlToImage(req, res, next) {
  try {
    const htmlText = req.body.html || '';
    const url = req.body.url || '';
    const format = req.body.format || 'png';
    const width = req.body.width ? parseInt(req.body.width) : 1200;
    const height = req.body.height ? parseInt(req.body.height) : 800;
    const fullPage = req.body.fullPage === 'true' || req.body.fullPage === true;

    if (!htmlText.trim() && !url.trim()) {
      return res.status(400).json({ error: 'Please provide either HTML content or a web URL' });
    }

    const imageBuffer = await convertHtmlToImage({ html: htmlText, url, format, width, height, fullPage });

    res.set({
      'Content-Type': format === 'png' ? 'image/png' : 'image/jpeg',
      'Content-Disposition': `attachment; filename="web_capture.${format}"`,
      'Content-Length': imageBuffer.length
    });
    res.send(imageBuffer);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  handleCompressImage,
  handleConvertHeic,
  handleConvertImage,
  handleAnalyzeImage,
  handleHtmlToImage
};
