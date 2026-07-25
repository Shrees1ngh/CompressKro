// ============================================================
// CompressKro Backend — QPDF Service
// Dedicated engine for qpdf linearizing (Fast Web View),
// object stream generation, and xref stream packing.
// ============================================================

const fs = require('fs');
const { execFileSync } = require('child_process');
const { detectBinaries } = require('../utils/binaries');

/**
 * Checks if qpdf binary is available on the system.
 */
function isQpdfAvailable() {
  const binaries = detectBinaries();
  return binaries.hasQpdf;
}

/**
 * Executes qpdf optimization and linearization pass on a PDF file.
 */
function processQpdf(inputPath, outputPath) {
  const binaries = detectBinaries();
  if (!binaries.hasQpdf) return false;

  try {
    execFileSync(binaries.qpdf, ['--linearize', '--object-streams=generate', inputPath, outputPath], { stdio: 'ignore', timeout: 45000 });
    return fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0;
  } catch (err) {
    return false;
  }
}

module.exports = {
  isQpdfAvailable,
  processQpdf
};
