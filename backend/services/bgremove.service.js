// ============================================================
// CompressKro Backend — Background Removal Service
// ============================================================

const { execFile } = require('child_process');
const os = require('os');

const isWindows = os.platform() === 'win32';

/**
 * Invokes python rembg command line utility directly using python -m rembg module.
 * Uses the specified model (default: isnet-general-use).
 * 
 * @param {string} inputPath Path to the input image file
 * @param {string} outputPath Path to write the output transparent PNG file
 * @param {string} model Saliency detection model key
 * @returns {Promise<string>} Path to output file
 */
function removeBackground(inputPath, outputPath, model = 'isnet-general-use') {
  return new Promise((resolve, reject) => {
    const pythonBin = isWindows ? 'python' : 'python3';
    
    // Spawns shell utility to execute: python -m rembg i -m <model> <inputPath> <outputPath>
    execFile(pythonBin, ['-m', 'rembg', 'i', '-m', model, inputPath, outputPath], (error, stdout, stderr) => {
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
