// ============================================================
// CompressKro Backend — MuPDF Service
// Dedicated engine for MuPDF (mutool) PDF stream cleaning,
// object deflating, font stream cleaning, and garbage collection.
// ============================================================

const fs = require('fs');
const { execFileSync } = require('child_process');
const { detectBinaries } = require('../utils/binaries');

/**
 * Checks if mutool binary is available on the system.
 */
function isMuPdfAvailable() {
  const binaries = detectBinaries();
  return binaries.hasMutool;
}

/**
 * Executes mutool clean pass on a PDF file.
 */
function processMuPdf(inputPath, outputPath) {
  const binaries = detectBinaries();
  if (!binaries.hasMutool) return false;

  try {
    execFileSync(binaries.mutool, ['clean', '-z', '-i', inputPath, outputPath], { stdio: 'ignore', timeout: 30000 });
    return fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0;
  } catch (err) {
    return false;
  }
}

module.exports = {
  isMuPdfAvailable,
  processMuPdf
};
