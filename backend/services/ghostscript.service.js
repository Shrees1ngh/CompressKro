// ============================================================
// CompressKro Backend — Ghostscript Service
// Dedicated engine for Ghostscript PDF distillation, font subsetting,
// stream compression, duplicate image detection, and raster downsampling.
// ============================================================

const fs = require('fs');
const { execFileSync } = require('child_process');
const { detectBinaries } = require('../utils/binaries');

/**
 * Checks if Ghostscript binary is available on the system.
 */
function isGhostscriptAvailable() {
  const binaries = detectBinaries(true);
  return binaries.hasGhostscript;
}

/**
 * Executes Ghostscript distillation pass on a PDF file using argument array.
 */
function processGhostscript(inputPath, outputPath, profile = 'balanced', category = 'text') {
  const binaries = detectBinaries();
  if (!binaries.hasGhostscript) return false;

  let settings = '/ebook';

  if (profile === 'smallest') {
    settings = '/screen';
  } else if (profile === 'best') {
    settings = '/printer';
  }

  const args = [
    '-q',
    '-dBATCH',
    '-dNOPAUSE',
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.4',
    `-dPDFSETTINGS=${settings}`,
    '-dDetectDuplicateImages=true',
    '-dCompressFonts=true',
    '-dSubsetFonts=true',
    '-dEmbedAllFonts=true',
    '-dAutoRotatePages=/None',
    `-sOutputFile=${outputPath}`,
    inputPath
  ];

  try {
    execFileSync(binaries.gs, args, { stdio: 'ignore', timeout: 60000 });
    return fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0;
  } catch (err) {
    console.warn('[Ghostscript Service] Process execution failed:', err.message);
    return false;
  }
}

module.exports = {
  isGhostscriptAvailable,
  processGhostscript
};
