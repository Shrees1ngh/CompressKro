// ============================================================
// CompressKro Backend — Background Removal Service
// ============================================================

const { execFile } = require('child_process');
const os = require('os');

const isWindows = os.platform() === 'win32';

/**
 * Invokes rembg to remove background from an image.
 * On Linux/Docker, uses /usr/local/bin/rembg-runner wrapper script that has
 * the correct PYTHONPATH baked in at Docker build time.
 * 
 * @param {string} inputPath Path to the input image file
 * @param {string} outputPath Path to write the output transparent PNG file
 * @param {string} model Saliency detection model key
 * @returns {Promise<string>} Path to output file
 */
function removeBackground(inputPath, outputPath, model = 'u2netp') {
  return new Promise((resolve, reject) => {
    // On Docker: use the wrapper script that sets PYTHONPATH correctly
    // On Windows dev: use local python
    const pythonBin = isWindows ? 'python' : '/usr/local/bin/rembg-runner';
    
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
