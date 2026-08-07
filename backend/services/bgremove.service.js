// ============================================================
// CompressKro Backend — Background Removal Service
// ============================================================

const { execFile } = require('child_process');
const os = require('os');

const isWindows = os.platform() === 'win32';

/**
 * Invokes python rembg to remove background from an image.
 * Uses the lightweight u2netp model by default.
 * 
 * @param {string} inputPath Path to the input image file
 * @param {string} outputPath Path to write the output transparent PNG file
 * @param {string} model Saliency detection model key
 * @returns {Promise<string>} Path to output file
 */
function removeBackground(inputPath, outputPath, model = 'u2netp') {
  return new Promise((resolve, reject) => {
    const pythonBin = isWindows ? 'python' : 'python3';
    
    // Explicitly pass PYTHONPATH to the python3 child process to ensure
    // packages installed globally under root context can be imported by node user
    const env = { ...process.env };
    if (!isWindows) {
      env.PYTHONPATH = [
        '/usr/local/lib/python3.11/dist-packages',
        '/usr/local/lib/python3.12/dist-packages',
        '/usr/local/lib/python3.10/dist-packages',
        '/usr/lib/python3/dist-packages',
        process.env.PYTHONPATH
      ].filter(Boolean).join(':');
    }

    // Spawns: python -c "import rembg.cli; rembg.cli.main()" i -m <model> <inputPath> <outputPath>
    execFile(pythonBin, ['-c', 'import rembg.cli; rembg.cli.main()', 'i', '-m', model, inputPath, outputPath], { env }, (error, stdout, stderr) => {
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
