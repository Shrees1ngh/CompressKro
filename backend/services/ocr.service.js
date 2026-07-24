// ============================================================
// CompressKro Backend — OCR Service
// Dedicated engine for OCRmyPDF / Tesseract integration.
// Generates searchable text layers for scanned image PDFs.
// ============================================================

const fs = require('fs');
const { execSync } = require('child_process');
const { detectBinaries } = require('../utils/binaries');

/**
 * Checks if OCR tools (OCRmyPDF / Tesseract) are available on the system.
 */
function isOcrAvailable() {
  const binaries = detectBinaries();
  return binaries.hasOcr;
}

/**
 * Executes OCRmyPDF pass to overlay a searchable text layer on a scanned PDF.
 */
function processOcr(inputPath, outputPath) {
  const binaries = detectBinaries();
  if (!binaries.ocrmypdf) return false;

  const ocrCmd = `${binaries.ocrmypdf} --skip-text --optimize 1 "${inputPath}" "${outputPath}"`;

  try {
    execSync(ocrCmd, { stdio: 'ignore', timeout: 120000 });
    return fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0;
  } catch (err) {
    return false;
  }
}

module.exports = {
  isOcrAvailable,
  processOcr
};
