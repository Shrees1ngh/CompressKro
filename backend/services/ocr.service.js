// ============================================================
// CompressKro Backend — OCR Service
// Dedicated engine for OCRmyPDF / Tesseract integration.
// Generates searchable text layers for scanned image PDFs.
// ============================================================

const fs = require('fs');
const { execFile } = require('child_process');
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
 * Returns a promise with { success: boolean, error?: string }.
 */
function processOcr(inputPath, outputPath) {
  const binaries = detectBinaries();
  if (!binaries.ocrmypdf) {
    console.error('[OCR] ocrmypdf binary not found');
    return Promise.resolve({ success: false, error: 'ocrmypdf binary not found on system' });
  }

  const args = ['--skip-text', '--optimize', '1', inputPath, outputPath];
  console.log(`[OCR] Running: ${binaries.ocrmypdf} ${args.join(' ')}`);

  return new Promise((resolve) => {
    execFile(binaries.ocrmypdf, args, { timeout: 120000 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[OCR] execFile error:`, error.message);
        if (stderr) console.error(`[OCR] stderr:`, stderr);
        if (stdout) console.log(`[OCR] stdout:`, stdout);
        resolve({ success: false, error: `OCR processing error: ${error.message}${stderr ? ' | ' + stderr.trim() : ''}` });
        return;
      }

      if (stderr) {
        console.warn(`[OCR] stderr (non-fatal):`, stderr);
      }

      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        console.log(`[OCR] Success: output at ${outputPath} (${fs.statSync(outputPath).size} bytes)`);
        resolve({ success: true });
      } else {
        console.error(`[OCR] Output file missing or empty after processing`);
        resolve({ success: false, error: 'OCR produced no output file' });
      }
    });
  });
}

module.exports = {
  isOcrAvailable,
  processOcr
};
