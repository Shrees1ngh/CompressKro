// ============================================================
// CompressKro Backend — Binary Tools Detector
// Cross-platform auto-detection for Ghostscript, qpdf, OCRmyPDF, Tesseract
// ============================================================

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const isWindows = os.platform() === 'win32';

let cachedBinaries = null;

function findGhostscript() {
  const candidates = isWindows
    ? ['gswin64c', 'gswin32c', 'gs']
    : ['gs', 'gswin64c'];

  for (const cmd of candidates) {
    try {
      execSync(`${cmd} --version`, { stdio: 'ignore' });
      return cmd;
    } catch {}
  }

  if (isWindows) {
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const gsDir = path.join(programFiles, 'gs');
    const gsDirX86 = path.join(programFilesX86, 'gs');

    for (const baseDir of [gsDir, gsDirX86]) {
      if (fs.existsSync(baseDir)) {
        try {
          const subdirs = fs.readdirSync(baseDir).reverse(); // inspect latest version first
          for (const sub of subdirs) {
            const binPath64 = path.join(baseDir, sub, 'bin', 'gswin64c.exe');
            if (fs.existsSync(binPath64)) return binPath64;

            const binPath32 = path.join(baseDir, sub, 'bin', 'gswin32c.exe');
            if (fs.existsSync(binPath32)) return binPath32;

            const binPathGs = path.join(baseDir, sub, 'bin', 'gs.exe');
            if (fs.existsSync(binPathGs)) return binPathGs;
          }
        } catch {}
      }
    }
  } else {
    const commonLinuxPaths = ['/usr/bin/gs', '/usr/local/bin/gs', '/usr/bin/gswin64c'];
    for (const lp of commonLinuxPaths) {
      if (fs.existsSync(lp)) return lp;
    }
  }

  return null;
}

function findCommand(cmdNames) {
  for (const cmd of cmdNames) {
    try {
      const checkCmd = isWindows ? `where.exe ${cmd}` : `which ${cmd}`;
      execSync(checkCmd, { stdio: 'ignore' });
      return cmd;
    } catch {}
  }
  return null;
}

function detectBinaries(forceRefresh = false) {
  if (cachedBinaries && !forceRefresh) return cachedBinaries;

  const gs = findGhostscript();
  const qpdf = findCommand(isWindows ? ['qpdf.exe', 'qpdf'] : ['qpdf']);
  const ocrmypdf = findCommand(isWindows ? ['ocrmypdf.exe', 'ocrmypdf'] : ['ocrmypdf']);
  const tesseract = findCommand(isWindows ? ['tesseract.exe', 'tesseract'] : ['tesseract']);
  const mutool = findCommand(isWindows ? ['mutool.exe', 'mutool'] : ['mutool']);

  cachedBinaries = {
    gs,
    qpdf,
    ocrmypdf,
    tesseract,
    mutool,
    hasGhostscript: !!gs,
    hasQpdf: !!qpdf,
    hasOcr: !!ocrmypdf || !!tesseract,
    hasMutool: !!mutool
  };

  return cachedBinaries;
}

module.exports = { detectBinaries };
