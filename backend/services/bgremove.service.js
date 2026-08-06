// ============================================================
// CompressKro Backend — Background Removal Service
// ============================================================

const { execFile, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const isWindows = os.platform() === 'win32';

/**
 * Searches for rembg binary dynamically on the host environment paths.
 */
function findRembg() {
  try {
    const checkCmd = isWindows ? 'where.exe rembg' : 'which rembg';
    const output = execSync(checkCmd, { encoding: 'utf8' }).trim();
    if (output) {
      return output.split('\r\n')[0].split('\n')[0];
    }
  } catch {}

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
            const scriptPath1 = path.join(baseDir, ver, 'Scripts', 'rembg.exe');
            if (fs.existsSync(scriptPath1)) return scriptPath1;
            
            const nestedDir = path.join(baseDir, ver);
            if (fs.statSync(nestedDir).isDirectory()) {
              const subdirs = fs.readdirSync(nestedDir);
              for (const sub of subdirs) {
                const scriptPath2 = path.join(nestedDir, sub, 'Scripts', 'rembg.exe');
                if (fs.existsSync(scriptPath2)) return scriptPath2;
              }
            }
          }
        } catch {}
      }
    }
  }
  return 'rembg'; // default fallback
}

/**
 * Invokes python rembg command line utility to remove background from an image.
 * Uses the specified model (default: isnet-general-use).
 * 
 * @param {string} inputPath Path to the input image file
 * @param {string} outputPath Path to write the output transparent PNG file
 * @param {string} model Saliency detection model key
 * @returns {Promise<string>} Path to output file
 */
function removeBackground(inputPath, outputPath, model = 'isnet-general-use') {
  return new Promise((resolve, reject) => {
    const rembgBin = findRembg();
    // Spawns shell utility to execute: rembg i -m <model> <inputPath> <outputPath>
    execFile(rembgBin, ['i', '-m', model, inputPath, outputPath], (error, stdout, stderr) => {
      if (error) {
        console.error('[BgRemove Service] Command execution error:', stderr || error.message);
        return reject(new Error(stderr || error.message));
      }
      resolve(outputPath);
    });
  });
}

module.exports = {
  removeBackground
};
