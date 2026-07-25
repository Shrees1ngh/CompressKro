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

function findTesseract() {
  const standard = findCommand(isWindows ? ['tesseract.exe', 'tesseract'] : ['tesseract']);
  if (standard) return standard;

  if (isWindows) {
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    
    for (const pf of [programFiles, programFilesX86]) {
      if (fs.existsSync(pf)) {
        try {
          const subdirs = fs.readdirSync(pf);
          for (const sub of subdirs) {
            if (sub.toLowerCase().startsWith('tesseract')) {
              const tPath = path.join(pf, sub, 'tesseract.exe');
              if (fs.existsSync(tPath)) return tPath;
            }
          }
        } catch {}
      }
      const tPath = path.join(pf, 'Tesseract-OCR', 'tesseract.exe');
      if (fs.existsSync(tPath)) return tPath;
    }
  }
  return null;
}

function findQpdf() {
  const standard = findCommand(isWindows ? ['qpdf.exe', 'qpdf'] : ['qpdf']);
  if (standard) return standard;

  if (isWindows) {
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    
    for (const pf of [programFiles, programFilesX86]) {
      if (fs.existsSync(pf)) {
        try {
          const subdirs = fs.readdirSync(pf);
          for (const sub of subdirs) {
            if (sub.toLowerCase().startsWith('qpdf')) {
              const qPath = path.join(pf, sub, 'bin', 'qpdf.exe');
              if (fs.existsSync(qPath)) return qPath;
            }
          }
        } catch {}
      }
      const qPath = path.join(pf, 'qpdf', 'bin', 'qpdf.exe');
      const qPathCaps = path.join(pf, 'QPDF', 'bin', 'qpdf.exe');
      if (fs.existsSync(qPath)) return qPath;
      if (fs.existsSync(qPathCaps)) return qPathCaps;
    }
  }
  return null;
}

function findOcrmypdf() {
  const standard = findCommand(isWindows ? ['ocrmypdf.exe', 'ocrmypdf'] : ['ocrmypdf']);
  if (standard) return standard;

  if (isWindows) {
    const homedir = os.homedir();
    const localAppData = process.env.LOCALAPPDATA || path.join(homedir, 'AppData', 'Local');
    const roamingAppData = process.env.APPDATA || path.join(homedir, 'AppData', 'Roaming');

    const searchDirs = [
      path.join(localAppData, 'Programs', 'Python'),
      path.join(roamingAppData, 'Python')
    ];

    for (const baseDir of searchDirs) {
      if (fs.existsSync(baseDir)) {
        try {
          const versions = fs.readdirSync(baseDir);
          for (const ver of versions) {
            const scriptPath1 = path.join(baseDir, ver, 'Scripts', 'ocrmypdf.exe');
            if (fs.existsSync(scriptPath1)) return scriptPath1;
            
            const nestedDir = path.join(baseDir, ver);
            if (fs.statSync(nestedDir).isDirectory()) {
              const subdirs = fs.readdirSync(nestedDir);
              for (const sub of subdirs) {
                const scriptPath2 = path.join(nestedDir, sub, 'Scripts', 'ocrmypdf.exe');
                if (fs.existsSync(scriptPath2)) return scriptPath2;
              }
            }
          }
        } catch {}
      }
    }
  }
  return null;
}

function detectBinaries(forceRefresh = false) {
  if (cachedBinaries && !forceRefresh) return cachedBinaries;

  const gs = findGhostscript();
  const qpdf = findQpdf();
  const ocrmypdf = findOcrmypdf();
  const tesseract = findTesseract();
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
