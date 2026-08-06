// ============================================================
// CompressKro Backend — Background Removal Service
// ============================================================

const { execFile } = require('child_process');
const os = require('os');

const isWindows = os.platform() === 'win32';

/**
 * Invokes python rembg to remove background from an image.
 * Uses the lightweight u2netp model by default (works within free-tier RAM limits).
 * 
 * @param {string} inputPath Path to the input image file
 * @param {string} outputPath Path to write the output transparent PNG file
 * @param {string} model Saliency detection model key
 * @returns {Promise<string>} Path to output file
 */
function removeBackground(inputPath, outputPath, model = 'u2netp') {
  return new Promise((resolve, reject) => {
    const pythonBin = isWindows ? 'python' : 'python3';
    
    // Spawns: python3 -m rembg i -m <model> <inputPath> <outputPath>
    // PYTHONPATH is set in the Dockerfile ENV so python3 always finds rembg
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
