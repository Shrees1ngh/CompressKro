const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { compressPdf } = require('../services/pdf.service');
const { lockPdfWithGs, unlockPdfWithGs, cleanPdfWithGs } = require('../services/ghostscript.service');

async function handleCompressPdf(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file provided' });
    }

    const level = req.body.level || 'balanced';
    const targetSizeKB = req.body.targetSizeKB ? parseInt(req.body.targetSizeKB) : null;
    const doOcr = req.body.ocr === 'true' || req.body.ocr === true || req.query.ocr === 'true';

    const result = await compressPdf(req.file.buffer, level, targetSizeKB, { doOcr });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="compressed_${req.file.originalname}"`,
      'Content-Length': result.buffer.length,
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

async function handleLockPdf(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No PDF file provided' });
    const userPassword = req.body.userPassword || '1234';
    const ownerPassword = req.body.ownerPassword || userPassword;

    const tempDir = os.tmpdir();
    const id = crypto.randomBytes(8).toString('hex');
    const inputPath = path.join(tempDir, `in_${id}.pdf`);
    const outputPath = path.join(tempDir, `locked_${id}.pdf`);

    fs.writeFileSync(inputPath, req.file.buffer);

    const success = lockPdfWithGs(inputPath, outputPath, userPassword, ownerPassword);
    
    // Cleanup input
    try { if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath); } catch {}

    if (!success || !fs.existsSync(outputPath)) {
      return res.status(500).json({ error: 'Failed to encrypt PDF' });
    }

    const outputBuffer = fs.readFileSync(outputPath);
    try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch {}

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="protected_${req.file.originalname}"`,
      'Content-Length': outputBuffer.length
    });
    res.send(outputBuffer);
  } catch (err) {
    next(err);
  }
}

async function handleUnlockPdf(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No PDF file provided' });
    const password = req.body.password || '';

    const tempDir = os.tmpdir();
    const id = crypto.randomBytes(8).toString('hex');
    const inputPath = path.join(tempDir, `in_${id}.pdf`);
    const outputPath = path.join(tempDir, `unlocked_${id}.pdf`);

    fs.writeFileSync(inputPath, req.file.buffer);

    const success = unlockPdfWithGs(inputPath, outputPath, password);
    
    // Cleanup input
    try { if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath); } catch {}

    if (!success || !fs.existsSync(outputPath)) {
      return res.status(400).json({ error: 'Failed to unlock PDF. Please verify the password.' });
    }

    const outputBuffer = fs.readFileSync(outputPath);
    try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch {}

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="unlocked_${req.file.originalname}"`,
      'Content-Length': outputBuffer.length
    });
    res.send(outputBuffer);
  } catch (err) {
    next(err);
  }
}

async function handleCleanPdf(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No PDF file provided' });

    const tempDir = os.tmpdir();
    const id = crypto.randomBytes(8).toString('hex');
    const inputPath = path.join(tempDir, `in_${id}.pdf`);
    const outputPath = path.join(tempDir, `clean_${id}.pdf`);

    fs.writeFileSync(inputPath, req.file.buffer);

    const success = cleanPdfWithGs(inputPath, outputPath);
    
    try { if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath); } catch {}

    if (!success || !fs.existsSync(outputPath)) {
      return res.status(500).json({ error: 'Failed to clean PDF annotations' });
    }

    const outputBuffer = fs.readFileSync(outputPath);
    try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch {}

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="clean_${req.file.originalname}"`,
      'Content-Length': outputBuffer.length
    });
    res.send(outputBuffer);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  handleCompressPdf,
  handleLockPdf,
  handleUnlockPdf,
  handleCleanPdf
};
